export type StockProduct = {
	id: string;
	name: string;
	cost: number;
	stock: number;
	description: string;
	durationDays: number;
};

export type StockAccess = {
	nome: string;
	valor: number;
	email: string;
	senha: string;
	adicional?: string;
};

export class StockApiError extends Error {
	constructor(public code: string, public uncertain = false) {
		super(`Falha na API de estoque (${code}).`);
	}
}

export function stockApiEnabled() {
	return process.env.STOCK_API_ENABLED === 'true';
}

export function retailPrice(cost: number, override?: number) {
	const margin = Number(process.env.STOCK_API_MARGIN_PERCENT || '30');
	if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(margin) || margin < 0) {
		throw new StockApiError('INVALID_PRICE');
	}
	const price = override && override > 0 ? override : Math.round(cost * (1 + margin / 100) * 100) / 100;
	if (!Number.isFinite(price) || price < cost) throw new StockApiError('PRICE_BELOW_COST');
	return price;
}

async function request(endpoint: string, body?: Record<string, string>): Promise<unknown> {
	const key = process.env.STOCK_API_KEY?.trim();
	if (!key) throw new StockApiError('MISSING_KEY');
	const base = new URL(process.env.STOCK_API_URL || 'https://vendasdoramon.squareweb.app');
	if (base.protocol !== 'https:' || base.username || base.password) throw new StockApiError('INVALID_URL');
	let response: Response;
	try {
		response = await fetch(new URL(endpoint, base), {
			method: body ? 'POST' : 'GET',
			headers: { 'X-Stock-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(20000),
			redirect: 'error',
		});
	} catch {
		// Nunca repetir automaticamente uma reserva: uma resposta perdida pode ter sido cobrada.
		throw new StockApiError('NETWORK', Boolean(body));
	}
	if (!response.ok) {
		const rejected = [400, 401, 402, 403, 404, 422].includes(response.status);
		throw new StockApiError(`HTTP_${response.status}`, Boolean(body) && !rejected);
	}
	try {
		return await response.json();
	} catch {
		throw new StockApiError('INVALID_RESPONSE', Boolean(body));
	}
}

export function parseStock(payload: unknown): StockProduct[] {
	const stock = (payload as { stock?: unknown })?.stock;
	if (!Array.isArray(stock)) throw new StockApiError('INVALID_CATALOG');
	return stock.map((entry) => {
		if (!entry || typeof entry.id !== 'string' || typeof entry.name !== 'string' || !entry.name.trim()
			|| typeof entry.price !== 'number' || !Number.isFinite(entry.price) || entry.price <= 0
			|| !Number.isInteger(entry.stock) || entry.stock < 0) {
			throw new StockApiError('INVALID_PRODUCT');
		}
		const days = Number(entry.duracao);
		return {
			id: entry.id, name: entry.name, cost: entry.price, stock: entry.stock,
			description: typeof entry.descricao === 'string' ? entry.descricao : '',
			durationDays: Number.isFinite(days) && days >= 0 ? days : 0,
		};
	});
}

export async function listStock() {
	return parseStock(await request('/api/stock'));
}

export function parseAccess(payload: unknown): StockAccess {
	const access = (payload as { access?: StockAccess })?.access;
	if (!access || typeof access.nome !== 'string' || typeof access.email !== 'string'
		|| typeof access.senha !== 'string' || (!access.email && !access.senha)
		|| typeof access.valor !== 'number' || !Number.isFinite(access.valor) || access.valor < 0) {
		throw new StockApiError('INVALID_ACCESS', true);
	}
	return {
		nome: access.nome, valor: access.valor, email: access.email, senha: access.senha,
		adicional: typeof access.adicional === 'string' ? access.adicional : '',
	};
}

export async function reserveStock(service: string, buyerId: string, saleId: string) {
	return parseAccess(await request('/api/stock/reserve', { service, buyer_id: buyerId, sale_id: saleId }));
}
