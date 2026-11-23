import { createRequire } from 'node:module';
const { test, before, after, beforeEach }: typeof import('node:test') = createRequire(__filename)('node:test');
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { stockOrderService } from '../src/services/stockOrders';
import { listStock, parseStock, retailPrice, reserveStock, StockApiError } from '../src/services/stockApi';

const directory = mkdtempSync(path.join(tmpdir(), 'stock-api-test-'));
const database = path.join(directory, 'test.sqlite');
const db = new PrismaClient({ datasources: { db: { url: `file:${database.replace(/\\/g, '/')}` } } });
let botId: number;
let userId: number;
const access = { nome: 'Produto', valor: 8, email: 'fixture@example.test', senha: 'fake-password' };
const input = () => ({ botId, userId, buyerWid: '5511999999999', pollId: 'poll-1', service: 'Produto', price: 10.4, cost: 8, additional: '30 dias' });

before(async () => {
	execFileSync('python', ['-c',
		'import sqlite3, pathlib, sys; c=sqlite3.connect(sys.argv[1]); [c.executescript(p.read_text(encoding="utf-8-sig")) for p in sorted(pathlib.Path(sys.argv[2]).glob("*/migration.sql"))]; c.close()',
		database, path.resolve('prisma/migrations')]);
});

beforeEach(async () => {
	await db.stockApiOrder.deleteMany();
	await db.bot.deleteMany();
	const bot = await db.bot.create({ data: { name: 'Principal', wid: '5511999999999@c.us', owner: 'owner@c.us' } });
	botId = bot.id;
	const user = await db.user.create({ data: { wid: '5511888888888@c.us', botId, balance: 100 } });
	userId = user.id;
	process.env.STOCK_API_MARGIN_PERCENT = '30';
});

after(async () => {
	await db.$disconnect();
	rmSync(directory, { recursive: true, force: true });
});

test('catálogo real, centavos, margem e preço personalizado', () => {
	const products = parseStock({ stock: [{ id: 'abc', name: 'Produto - especial', price: 1.99, stock: 2, descricao: 'Info', duracao: '30' }] });
	assert.equal(products[0].durationDays, 30);
	assert.equal(retailPrice(products[0].cost), 2.59);
	assert.equal(retailPrice(8), 10.4);
	assert.equal(retailPrice(8, 12.99), 12.99);
	assert.throws(() => retailPrice(8, 7));
	assert.throws(() => parseStock({ stock: [{ id: 'abc', name: 'X', price: 1, stock: -1 }] }));
});

test('contrato HTTP: chave no header e identificadores no POST, sem comprar na API real', async () => {
	const original = globalThis.fetch;
	process.env.STOCK_API_KEY = 'fixture-key';
	try {
		let calls = 0;
		globalThis.fetch = (async (url, options) => {
			calls++;
			assert.equal((options?.headers as Record<string, string>)['X-Stock-Key'], 'fixture-key');
			assert.equal(options?.redirect, 'error');
			if (calls === 1) {
				assert.equal(new URL(String(url)).pathname, '/api/stock');
				return new Response(JSON.stringify({ stock: [] }));
			}
			assert.equal(new URL(String(url)).pathname, '/api/stock/reserve');
			assert.equal(options?.method, 'POST');
			assert.deepEqual(JSON.parse(options?.body as string), { service: 'Produto', buyer_id: '123', sale_id: 'pedido-1' });
			return new Response(JSON.stringify({ access }));
		}) as typeof fetch;
		assert.deepEqual(await listStock(), []);
		assert.deepEqual(await reserveStock('Produto', '123', 'pedido-1'), { ...access, adicional: '' });
		assert.equal(calls, 2);
	} finally { globalThis.fetch = original; }
});

test('compra debita centavos e salva acesso no histórico; repetição não compra novamente', async () => {
	let calls = 0;
	const orders = stockOrderService(db, async () => { calls++; return access; });
	const first = await orders.buy(input());
	const second = await orders.buy(input());
	assert.equal(first.status, 'COMPLETED');
	assert.equal(first.id, second.id);
	assert.equal(calls, 1);
	assert.equal(await db.loginsHistory.count(), 1);
	assert.ok(Math.abs((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance - 89.6) < 1e-9);
});

test('saldo insuficiente e usuário de outro bot nunca chamam o fornecedor', async () => {
	let calls = 0;
	const orders = stockOrderService(db, async () => { calls++; return access; });
	await assert.rejects(orders.buy({ ...input(), price: 101 }));
	await assert.rejects(orders.buy({ ...input(), botId: botId + 1000 }));
	assert.equal(calls, 0);
	assert.equal(await db.stockApiOrder.count(), 0);
});

test('recusa definitiva devolve saldo uma única vez', async () => {
	const orders = stockOrderService(db, async () => { throw new StockApiError('HTTP_402'); });
	const order = await orders.buy(input());
	assert.equal(order.status, 'REFUNDED');
	await orders.refund(order.id);
	assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance, 100);
	assert.equal(await db.loginsHistory.count(), 0);
});

test('timeout retém pedido para revisão, bloqueia nova compra e não repete o POST', async () => {
	let calls = 0;
	const orders = stockOrderService(db, async () => { calls++; throw new StockApiError('NETWORK', true); });
	const order = await orders.buy(input());
	assert.equal(order.status, 'REVIEW');
	await orders.buy(input());
	await assert.rejects(orders.buy({ ...input(), pollId: 'other' }));
	assert.equal(calls, 1);
	await orders.refund(order.id, true);
	await orders.refund(order.id, true);
	assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance, 100);
});

test('acesso recebido é recuperado sem nova reserva, mesmo após recriar o serviço', async () => {
	const order = await db.stockApiOrder.create({ data: {
		id: 'recovery', requestKey: 'recovery', botId, userId, serviceName: 'Produto', price: 10.4, cost: 8,
		status: 'RECEIVED', accessJson: JSON.stringify(access),
	} });
	const orders = stockOrderService(db, async () => { throw new Error('não deve chamar'); });
	await orders.finish(order.id);
	await orders.finish(order.id);
	assert.equal(await db.loginsHistory.count(), 1);
	await assert.rejects(orders.refund(order.id, true));
});

test('concorrência na mesma enquete faz apenas uma reserva', async () => {
	let calls = 0;
	const orders = stockOrderService(db, async () => { calls++; return access; });
	await Promise.allSettled([orders.buy(input()), orders.buy(input())]);
	assert.equal(calls, 1);
	assert.equal(await db.stockApiOrder.count(), 1);
	assert.equal(await db.loginsHistory.count(), 1);
});

test('duas compras concorrentes não deixam o saldo negativo', async () => {
	await db.user.update({ where: { id: userId }, data: { balance: 10.4 } });
	let calls = 0;
	const orders = stockOrderService(db, async () => { calls++; return access; });
	await Promise.allSettled([orders.buy(input()), orders.buy({ ...input(), pollId: 'poll-2' })]);
	assert.equal(calls, 1);
	assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).balance, 0);
});
