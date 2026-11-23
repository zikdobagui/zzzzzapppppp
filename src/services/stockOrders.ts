import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient, StockApiOrder } from '@prisma/client';
import prisma from './prisma';
import { reserveStock, StockAccess, StockApiError } from './stockApi';

export class PurchaseError extends Error {}

// Injeções permitem testar concorrência e falhas sem consumir saldo do fornecedor.
export function stockOrderService(db: PrismaClient = prisma, reserve = reserveStock) {
	async function finish(orderId: string) {
		return db.$transaction(async (tx) => {
			const order = await tx.stockApiOrder.findUniqueOrThrow({ where: { id: orderId } });
			if (order.status === 'COMPLETED') return order;
			if (order.status !== 'RECEIVED' || !order.accessJson) throw new PurchaseError('Pedido ainda não confirmado pelo fornecedor.');
			const access = JSON.parse(order.accessJson) as StockAccess & { additional?: string };
			const claimed = await tx.stockApiOrder.updateMany({ where: { id: orderId, status: 'RECEIVED' }, data: { status: 'COMPLETED' } });
			if (!claimed.count) throw new PurchaseError('Pedido já está sendo finalizado.');
			const history = await tx.loginsHistory.create({ data: {
				botId: order.botId, userId: order.userId, loginName: order.serviceName, loginPrice: order.price,
				loginUser: access.email, loginPassword: access.senha, loginAdditional: access.additional || access.adicional || '',
			} });
			return tx.stockApiOrder.update({ where: { id: orderId }, data: { historyId: history.id } });
		});
	}

	async function refund(orderId: string, manual = false) {
		return db.$transaction(async (tx) => {
			const order = await tx.stockApiOrder.findUniqueOrThrow({ where: { id: orderId } });
			if (order.status === 'REFUNDED') return order;
			const allowed = manual ? ['REVIEW', 'PROCESSING'] : ['REJECTED'];
			if (!allowed.includes(order.status) || order.accessJson) throw new PurchaseError('Este pedido não pode ser estornado.');
			if (manual && order.status === 'PROCESSING' && Date.now() - order.updatedAt.getTime() < 5 * 60 * 1000) {
				throw new PurchaseError('Aguarde 5 minutos: a reserva ainda pode estar em andamento.');
			}
			const claimed = await tx.stockApiOrder.updateMany({ where: { id: orderId, status: order.status }, data: { status: 'REFUNDED' } });
			if (!claimed.count) throw new PurchaseError('O pedido mudou de estado. Consulte novamente.');
			await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: order.price } } });
			return tx.stockApiOrder.findUniqueOrThrow({ where: { id: orderId } });
		});
	}

	async function buy(input: { botId: number; userId: number; buyerWid: string; pollId: string; service: string; price: number; cost: number; additional: string }) {
		if (!Number.isFinite(input.price) || input.price <= 0 || input.price < input.cost) throw new PurchaseError('Preço inválido. Atualize a lista.');
		const requestKey = createHash('sha256').update(JSON.stringify([input.botId, input.userId, input.pollId])).digest('hex');
		const existing = await db.stockApiOrder.findUnique({ where: { requestKey } });
		if (existing) return existing.status === 'RECEIVED' ? finish(existing.id) : existing;
		let order: StockApiOrder;
		try {
			order = await db.$transaction(async (tx) => {
				const pending = await tx.stockApiOrder.findFirst({ where: { botId: input.botId, userId: input.userId, status: { in: ['PROCESSING', 'REVIEW', 'RECEIVED', 'REJECTED'] } } });
				if (pending) throw new PurchaseError(`Você possui um pedido pendente: ${pending.id}. Consulte /apipedido ${pending.id}.`);
				const debited = await tx.user.updateMany({ where: { id: input.userId, botId: input.botId, balance: { gte: input.price } }, data: { balance: { decrement: input.price } } });
				if (!debited.count) throw new PurchaseError('Você não tem saldo suficiente.');
				return tx.stockApiOrder.create({ data: { id: `zap-${randomUUID()}`, requestKey, botId: input.botId, userId: input.userId, serviceName: input.service, price: input.price, cost: input.cost } });
			});
		} catch (error) {
			const duplicate = await db.stockApiOrder.findUnique({ where: { requestKey } });
			if (duplicate) return duplicate;
			throw error;
		}
		let access: StockAccess;
		try {
			access = await reserve(input.service, input.buyerWid, order.id);
		} catch (error) {
			const uncertain = !(error instanceof StockApiError) || error.uncertain;
			await db.stockApiOrder.update({ where: { id: order.id }, data: { status: uncertain ? 'REVIEW' : 'REJECTED', errorCode: error instanceof StockApiError ? error.code : 'INTERNAL' } });
			return uncertain ? db.stockApiOrder.findUniqueOrThrow({ where: { id: order.id } }) : refund(order.id);
		}
		// Salva o acesso antes de gerar o histórico. Uma falha posterior pode ser recuperada sem nova compra.
		await db.stockApiOrder.update({ where: { id: order.id }, data: { status: 'RECEIVED', accessJson: JSON.stringify({ ...access, additional: [input.additional, access.adicional].filter(Boolean).join('\n') }) } });
		return finish(order.id);
	}

	return { buy, finish, refund };
}

export const stockOrders = stockOrderService();
