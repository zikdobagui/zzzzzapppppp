import { Client, Command } from '@/types/client';
import { Message } from '@wppconnect-team/wppconnect';
import prisma from '@/services/prisma';
import { listStock, retailPrice } from '@/services/stockApi';
import { stockOrders, PurchaseError } from '@/services/stockOrders';
import { deliverApiOrder, usesStockApi } from '@/buttons/apiLogins';

export async function commandApiProducts(client: Client, message: Message) {
	if (!client.db || !usesStockApi(client)) {
		await client.sendText(message.from, 'A API está habilitada apenas para o bot Principal.');
		return;
	}
	try {
		const products = await listStock();
		const rows: string[] = [];
		for (const product of products) {
			const setting = await prisma.loginsSettings.findUnique({ where: { name: product.name } });
			if (setting && setting.botId !== client.db.id) {
				rows.push(`${product.name}: nome já cadastrado em outro bot; contate o suporte.`);
				continue;
			}
			if (!setting) await prisma.loginsSettings.create({ data: { name: product.name, botId: client.db.id } });
			let price = 'ajuste necessário (preço menor que custo)';
			try { price = `R$ ${retailPrice(product.cost, setting?.price).toFixed(2)}`; } catch {}
			rows.push(`${product.name}\nCusto: R$ ${product.cost.toFixed(2)} | Venda: ${price} | Estoque: ${product.stock}`);
		}
		await client.sendText(message.from, `*Catálogo da API*\n\n${rows.join('\n\n')}\n\nPreço personalizado: /price NOME EXATO|10,40\nMargem padrão: STOCK_API_MARGIN_PERCENT no .env.`);
	} catch {
		await client.sendText(message.from, 'Não foi possível consultar o catálogo. Confira a chave da API e tente novamente.');
	}
}

export async function commandApiOrder(client: Client, message: Message, command: Command) {
	const id = command.args[0];
	if (!client.db || !id) {
		await client.sendText(message.from, 'Uso: /apipedido ID_DO_PEDIDO');
		return;
	}
	if (message.from.endsWith('@g.us')) {
		await client.sendText(message.from, 'Consulte seu pedido no privado com o bot.');
		return;
	}
	const user = await prisma.user.findFirst({ where: { botId: client.db.id, wid: message.from } });
	let order = user && await prisma.stockApiOrder.findFirst({ where: { id, botId: client.db.id, userId: user.id } });
	if (!order) {
		await client.sendText(message.from, 'Pedido não encontrado para sua conta.');
		return;
	}
	if (order.status === 'RECEIVED') order = await stockOrders.finish(order.id);
	if (order.status === 'REJECTED') order = await stockOrders.refund(order.id);
	await deliverApiOrder(client, message.from, order);
}

export async function commandApiOrders(client: Client, message: Message) {
	if (!client.db) return;
	const orders = await prisma.stockApiOrder.findMany({ where: { botId: client.db.id, status: { notIn: ['COMPLETED', 'REFUNDED'] } }, orderBy: { createdAt: 'desc' }, take: 30 });
	await client.sendText(message.from, orders.length ? orders.map((order) => `${order.id}\n${order.serviceName} | R$ ${order.price.toFixed(2)} | ${order.status}\n${order.errorCode || '-'} | ${order.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`).join('\n\n') : 'Nenhum pedido pendente na API.');
}

export async function commandApiRefund(client: Client, message: Message, command: Command) {
	if (!client.db) return;
	const order = await prisma.stockApiOrder.findFirst({ where: { id: command.args[0] || '', botId: client.db.id } });
	if (!order) {
		await client.sendText(message.from, 'Pedido não encontrado. Uso: /apiestornar ID_DO_PEDIDO');
		return;
	}
	try {
		await stockOrders.refund(order.id, order.status !== 'REJECTED');
		await client.sendText(message.from, `Pedido ${order.id} estornado. O saldo do cliente foi devolvido. Este comando não cancela cobranças no fornecedor.`);
	} catch (error) {
		if (!(error instanceof PurchaseError)) throw error;
		await client.sendText(message.from, error.message);
	}
}
