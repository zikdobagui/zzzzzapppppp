import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { showTelegramLogins, responseTelegramLogin, tryTelegramPix, walletStatus } from '../src/buttons/telegramWallet';
import type { Client, PollResponse } from '../src/types/client';
const { test }: typeof import('node:test') = createRequire(__filename)('node:test');

test('compra e Pix usam a API do cadastro Telegram; timeout consulta o mesmo pedido sem repetir POST', async () => {
 const env = { ...process.env }; const originalFetch = globalThis.fetch;
 const messages: string[] = []; const requests: { path: string; init?: RequestInit }[] = [];
 const client = { wid: '5511888888888@c.us', sendText: async (_to: string, text: string) => { messages.push(text); },
  sendPollMessage: async () => ({ id: 'true_phone_POLL' }) } as unknown as Client;
 const data = { sender: '5511999999999@c.us', chatId: '5511999999999@c.us', msgId: { id: 'POLL' }, selected: { added: 'TG • Produto — R$ 10.00' } } as unknown as PollResponse;
 let balance = 92.5; let purchases = 1; let stored: any; let lost = false;
 try {
  process.env.TELEGRAM_ENABLED = 'true'; process.env.TELEGRAM_BOT_PHONE = '5511888888888';
  process.env.TELEGRAM_BASE_URL = 'https://example.test'; process.env.WHATSAPP_API_KEY = 'client-key'; process.env.WHATSAPP_CATALOG_API_KEY = 'catalog-key';
  globalThis.fetch = async (url, init) => {
   const path = new URL(String(url)).pathname; requests.push({ path, init });
   if (path.endsWith('/produtos')) return new Response(JSON.stringify({ produtos: [{ nome: 'Produto', preco: 10, estoque: 2 }] }));
   if (path.endsWith('/comprar')) {
    assert.equal((init?.headers as any).Authorization, 'Bearer client-key');
    const body = JSON.parse(String(init?.body)); assert.equal(body.produto, 'Produto'); assert.equal(body.preco, 10);
    if (!stored || stored.operacao !== body.operacao) { balance -= 10; purchases++; }
    stored = { operacao: body.operacao, status: 'DONE', resultado: { saldo: balance, entregues: [{ nome: 'Produto', valor: 10, email: 'login', senha: 'password' }] } };
    if (lost) throw new Error('resposta perdida');
    return new Response(JSON.stringify(stored));
   }
   if (path.includes('/operacoes/')) return new Response(JSON.stringify(stored));
   if (path.endsWith('/pix')) {
    const body = JSON.parse(String(init?.body)); assert.equal(body.valor, 15.5);
    return new Response(JSON.stringify({ status: 'DONE', resultado: { id_pag: 'pay', copia: 'pix-code', valor: 15.5, total: 15.5 } }));
   }
   if (path.endsWith('/pix/pay/status')) return new Response(JSON.stringify({ pago: true, saldo: balance + 15.5 }));
   return new Response(JSON.stringify({ saldo: balance, total_compras: purchases }));
  };
  assert.equal(await showTelegramLogins(client, data), true);
  await responseTelegramLogin(client, data);
  assert.equal(balance, 82.5);
  assert.ok(messages.some(t => t.includes('Seu saldo:* R$ 82.50')));
  assert.ok(messages.some(t => t.includes('password')));
  lost = true;
  await responseTelegramLogin(client, data);
  assert.equal(requests.filter(r => r.path.endsWith('/comprar')).length, 2);
  assert.equal(balance, 82.5, 'a resposta repetida usa a mesma operação sem novo débito');
  assert.ok(requests.at(-1)?.path.includes('/operacoes/'));
  assert.equal(requests.filter(r => r.init?.method === 'POST').length, 2, 'perda de resposta não repete o POST');
  await tryTelegramPix(client, { from: data.sender, id: 'msg-pix' }, { name: '/pix', args: ['15,50'] });
  assert.ok(messages.some(t => t.includes('pix-code')));
  await walletStatus(client, data.sender, '/statuspix', 'pay');
  assert.ok(messages.at(-1)?.includes('Pagamento aprovado'));
  globalThis.fetch = async () => new Response('{}', { status: 503 });
  assert.equal(await showTelegramLogins(client, data), true, 'indisponibilidade não libera compra no banco local');
  assert.equal(await tryTelegramPix(client, { from: data.sender, id: 'next' }, { name: '/pix', args: ['10'] }), true);
 } finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
 }
});
