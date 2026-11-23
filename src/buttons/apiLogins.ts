import { StockApiOrder } from '@prisma/client';
import { Client, PollResponse } from '@/types/client';
import prisma from '@/services/prisma';
import { listStock, retailPrice, stockApiEnabled, StockProduct, StockAccess } from '@/services/stockApi';
import { stockOrders, PurchaseError } from '@/services/stockOrders';
import { notifyAdmin } from '@/helpers/notify';
import { notifySales } from '@/commands/notifySales';

type Quote = { product: StockProduct; price: number };
const polls = new Map<string, { expires: number; choices: Map<string, Quote>; offset: number }>();
const limit = 8;

export function usesStockApi(client: Client) {
	return stockApiEnabled() && client.db?.name === 'Principal';
}

function pollKey(client: Client, sender: string, id: string) {
	// WPP retorna o ID serializado ao enviar, mas o evento da enquete contém somente a parte final.
	return `${client.db!.id}:${sender}:${id.split('_').pop()}`;
}

export async function showApiLogins(client: Client, data: PollResponse, offset = 0) {
	if (!client.db) return;
	if (data.chatId.endsWith('@g.us')) {
		await client.sendText(data.chatId, 'Abra a conversa privada com o bot para comprar.');
		return;
	}
	try {
		const products = await listStock();
		const available = products.filter((product) => product.stock > 0);
		if (!available.length) {
			await client.sendText(data.chatId, 'Sem estoque de logins no momento.');
			return;
		}
		offset = Math.min(Math.max(offset, 0), Math.floor((available.length - 1) / limit) * limit);
		const choices = new Map<string, Quote>();
		for (const product of available.slice(offset, offset + limit)) {
			const setting = await prisma.loginsSettings.findUnique({ where: { name: product.name } });
			if (setting && setting.botId !== client.db.id) continue;
			if (!setting) await prisma.loginsSettings.create({ data: { name: product.name, botId: client.db.id } });
			let price: number;
			try { price = retailPrice(product.cost, setting?.price); } catch { continue; }
			choices.set(`${product.name} - R$ ${price.toFixed(2)} - Estoque: ${product.stock}`, { product, price });
		}
		if (!choices.size) {
			await client.sendText(data.chatId, 'Os produtos desta página precisam de ajuste de preço. Entre em contato com o suporte.');
			return;
		}
		const user = await prisma.user.findFirst({ where: { botId: client.db.id, wid: data.sender } });
		const options = [...choices.keys()];
		if (offset + limit < available.length) options.push('Proximo');
		if (offset > 0) options.push('Anterior');
		const sent = await client.sendPollMessage(data.chatId, `*Seu saldo: R$ ${(user?.balance || 0).toFixed(2)}*\n\n${client.db.textLogin}\n\nSelecione um produto para comprar.`, options, { selectableCount: 1 });
		for (const [key, value] of polls) if (value.expires < Date.now()) polls.delete(key);
		polls.set(pollKey(client, data.sender, sent.id), { expires: Date.now() + 15 * 60 * 1000, choices, offset });
	} catch {
		await client.sendText(data.chatId, 'O catálogo do fornecedor está indisponível. Tente novamente em alguns minutos.');
	}
}

export async function deliverApiOrder(client: Client, recipient: string, order: StockApiOrder) {
	if (order.status === 'COMPLETED' && order.accessJson) {
		const access = JSON.parse(order.accessJson) as StockAccess & { additional?: string };
		await client.sendText(recipient,
			`*LOGIN COMPRADO COM SUCESSO*\n\nPedido: ${order.id}\nProduto: ${order.serviceName}\nValor: R$ ${order.price.toFixed(2)}\n\n*Usuário/acesso:* ${access.email || '-'}\n*Senha/código:* ${access.senha || '-'}\n${access.additional || access.adicional || ''}\n\nO acesso também está no seu Histórico de Logins.`);
	} else if (order.status === 'REFUNDED' || order.status === 'REJECTED') {
		await client.sendText(recipient, `O fornecedor recusou o pedido ${order.id}.${order.status === 'REFUNDED' ? ' O valor foi devolvido ao seu saldo.' : ' Seu estorno está pendente; contate o suporte.'}`);
	} else {
		await client.sendText(recipient, `Pedido ${order.id} aguardando confirmação. O valor está reservado no seu saldo. Não refaça a compra; consulte /apipedido ${order.id} ou fale com o suporte.`);
	}
}

export async function responseApiLogin(client: Client, data: PollResponse) {
	if (!client.db || !data.selected?.added) return;
	const selected = data.selected.added;
	const page = polls.get(pollKey(client, data.sender, data.msgId.id));
	if (!page || page.expires < Date.now()) {
		await client.sendText(data.chatId, 'Esta lista expirou. Abra Logins novamente para consultar os preços atuais.');
		return;
	}
	if (selected === 'Proximo' || selected === 'Anterior') {
		await showApiLogins(client, data, page.offset + (selected === 'Proximo' ? limit : -limit));
		return;
	}
	const quote = page.choices.get(selected);
	if (!quote) return;
	const user = await prisma.user.findFirst({ where: { botId: client.db.id, wid: data.sender } });
	if (!user) {
		await client.sendText(data.chatId, 'Envie uma mensagem ao bot no privado para se cadastrar.');
		return;
	}
	try {
		const current = (await listStock()).find((product) => product.id === quote.product.id);
		if (!current || !current.stock) throw new PurchaseError('Este produto ficou sem estoque. Abra Logins novamente.');
		const setting = await prisma.loginsSettings.findUnique({ where: { name: current.name } });
		const price = retailPrice(current.cost, setting?.botId === client.db.id ? setting.price : undefined);
		if (price !== quote.price || current.name !== quote.product.name) throw new PurchaseError('O preço mudou. Abra Logins novamente antes de comprar.');
		const order = await stockOrders.buy({
			botId: client.db.id, userId: user.id, buyerWid: user.wid.replace(/\D/g, ''), pollId: data.msgId.id,
			service: current.name, price, cost: current.cost,
			additional: [current.description, current.durationDays > 0 ? `Duração: ${current.durationDays} dias.` : '', setting?.text].filter(Boolean).join('\n'),
		});
		await deliverApiOrder(client, data.sender, order);
		if (order.status === 'COMPLETED' && setting) {
			await notifySales(client, { ...setting, price }, user.wid).catch(() => undefined);
		}
		await notifyAdmin(client, `Pedido API ${order.id}\nProduto: ${order.serviceName}\nCliente: ${user.wid}\nVenda: R$ ${order.price.toFixed(2)}\nCusto: R$ ${order.cost.toFixed(2)}\nStatus: ${order.status}`).catch(() => undefined);
	} catch (error) {
		await client.sendText(data.sender, error instanceof PurchaseError ? error.message : 'Não foi possível concluir a solicitação. Confira seu Histórico de Logins antes de tentar novamente ou contate o suporte.');
	}
}
