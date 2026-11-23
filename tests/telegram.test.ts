import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { telegramApi, telegramPhone, linkTelegram, TelegramApiError } from '../src/services/telegramApi';
import { handleTelegram } from '../src/events/telegram';
const { test }: typeof import('node:test') = createRequire(__filename)('node:test');

test('integração usa chaves separadas, rejeita redirecionamento e reconcilia vínculo sem repetir POST', async () => {
 const originalFetch = globalThis.fetch;
 const originalEnv = { ...process.env };
 const requests: { url: string; init?: RequestInit }[] = [];
 process.env.TELEGRAM_BASE_URL = 'https://example.test';
 process.env.WHATSAPP_API_KEY = 'client-secret';
 process.env.WHATSAPP_CATALOG_API_KEY = 'catalog-secret';
 process.env.TELEGRAM_ENABLED = 'true';
 process.env.TELEGRAM_BOT_PHONE = '5511888888888';
 const messages: string[] = [];
 const client = { wid: '5511888888888@c.us', sendText: async (_to: string, text: string) => { messages.push(text); } };
 try {
  globalThis.fetch = async (input, init) => {
   requests.push({ url: String(input), init });
   return new Response(JSON.stringify({ cliente_id: '123', saldo: 25.5, produtos: [] }));
  };
  assert.equal(telegramPhone('5511999999999:2@c.us'), '5511999999999');
  assert.throws(() => telegramPhone('5511999999999@lid'));
  await telegramApi('/api/whatsapp/v1/produtos', { catalogo: true });
  assert.equal((requests[0].init?.headers as any).Authorization, 'Bearer catalog-secret');
  assert.equal(requests[0].init?.redirect, 'error');
  await handleTelegram(client, { from: '5511999999999@c.us', body: '/saldotelegram 5511000000000' });
  assert.ok(requests[1].url.endsWith('/clientes/5511999999999'));
  assert.equal((requests[1].init?.headers as any).Authorization, 'Bearer client-secret');
  const count = requests.length;
  await handleTelegram(client, { from: '123@g.us', body: '/vincular SECRET', isGroupMsg: true });
  await handleTelegram(client, { from: '123@lid', body: '/vincular SECRET' });
  await handleTelegram(client, { from: '5511999999999@c.us', body: '/vincular SECRET', fromMe: true });
  assert.equal(requests.length, count);
  globalThis.fetch = async (input, init) => {
   requests.push({ url: String(input), init });
   if (init?.method === 'POST') throw new Error('lost response');
   return new Response(JSON.stringify({ cliente_id: '123', saldo: 25.5 }));
  };
  await linkTelegram('5511999999999', 'PRIVATE-CODE');
  assert.equal(requests.filter(r => r.init?.method === 'POST').length, 1);
  assert.ok(requests.at(-1)?.url.endsWith('/clientes/5511999999999'));
  globalThis.fetch = async () => new Response('{}', { status: 409 });
  await assert.rejects(linkTelegram('5511999999999', 'PRIVATE-CODE'), (e: unknown) => e instanceof TelegramApiError && e.status === 409);
  globalThis.fetch = async () => new Response(JSON.stringify({ erro: 'PRIVATE-CODE client-secret' }), { status: 401 });
  await handleTelegram(client, { from: '5511999999999@c.us', body: '/vincular PRIVATE-CODE' });
  assert.ok(!messages.join(' ').includes('PRIVATE-CODE'));
  assert.ok(!messages.join(' ').includes('client-secret'));
  // Primeiro contato pede o código; próxima mensagem faz o vínculo pelo remetente real.
  let linked = false;
  globalThis.fetch = async (input, init) => {
   requests.push({ url: String(input), init });
   if (init?.method === 'POST') {
    linked = true;
    return new Response(JSON.stringify({ vinculado: true, cliente_id: '123' }));
   }
   return linked ? new Response(JSON.stringify({ cliente_id: '123', username: 'cliente', whatsapp: '5511777777777', saldo: 25.5, total_compras: 2 })) : new Response('{}', { status: 404 });
  };
  assert.equal(await handleTelegram(client, { from: '5511777777777@c.us', body: 'oi' }), true);
  assert.ok(messages.some(text => text.includes('VINCULE SUA CONTA DO TELEGRAM')));
  await handleTelegram(client, { from: '5511777777777@c.us', body: 'FIRST-CONTACT-CODE' });
  const linkRequest = requests.filter(r => r.init?.method === 'POST').at(-1)!;
  assert.ok(requests.at(-1)?.url.endsWith('/clientes/5511777777777'));
  assert.ok(messages.at(-1)?.includes('R$ 25.50'));
  assert.ok(messages.at(-1)?.includes('Usuário: cliente'));
  assert.ok(messages.at(-1)?.includes('Compras: 2'));
  assert.equal(linkRequest.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(linkRequest.init?.body)), { codigo: 'FIRST-CONTACT-CODE', whatsapp: '5511777777777' });
  globalThis.fetch = async () => new Response(JSON.stringify({ cliente_id: '123', saldo: 25.5 }));
  assert.equal(await handleTelegram(client, { from: '5511777777777@c.us', body: 'oi de novo' }), false);
  const polls: string[][] = [];
  const pollClient = { ...client, sendPollMessage: async (_to: string, _title: string, options: string[]) => { polls.push(options); } };
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  await handleTelegram(pollClient, { from: '5511666666666@c.us', body: '/menu' });
  assert.ok(polls[0].some(option => option.includes('ir para a loja')));
  assert.ok(polls[0].some(option => option.includes('Preciso de ajuda')));
  assert.equal(await handleTelegram(pollClient, { from: '5511666666666@c.us', body: '/loja' }), false);
  globalThis.fetch = async () => { throw new Error('Não deve consultar após pular'); };
  assert.equal(await handleTelegram(pollClient, { from: '5511666666666@c.us', body: 'oi' }), false);
  // Falha na consulta inicial não deve preceder o convite com aviso de erro.
  const beforeUnavailable = messages.length;
  globalThis.fetch = async () => new Response('{}', { status: 503 });
  await handleTelegram(pollClient, { from: '5511555555555@c.us', body: 'oi' });
  const firstContact = messages.slice(beforeUnavailable);
  assert.ok(firstContact[0].includes('VINCULE SUA CONTA DO TELEGRAM'));
  assert.ok(!firstContact.some(text => text.includes('indisponível')));
  await handleTelegram(pollClient, { from: '5511555555555@c.us', body: 'CLIENT-CODE' });
  assert.ok(messages.at(-1)?.includes('indisponível') || messages.at(-1)?.includes('Não foi possível confirmar'));
  let configurationCalls = 0;
  globalThis.fetch = async () => {
   configurationCalls++;
   return new Response(JSON.stringify({ erro: 'integracao nao configurada' }), { status: 503 });
  };
  await assert.rejects(linkTelegram('5511444444444', 'TEST-CODE'),
   (e: unknown) => e instanceof TelegramApiError && e.reason === 'NOT_CONFIGURED' && !e.uncertain);
  assert.equal(configurationCalls, 1, 'rejeição explícita não é tratada como resposta perdida');
  await handleTelegram(pollClient, { from: '5511444444444@c.us', body: '/vincular TEST-CODE' });
  assert.ok(messages.at(-1)?.includes('ainda não foi ativado'));
  assert.ok(!messages.at(-1)?.includes('Não foi possível confirmar'));
  process.env.TELEGRAM_BASE_URL = 'http://example.test';
  await assert.rejects(telegramApi('/api/whatsapp/v1/produtos'), TelegramApiError);
 } finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
 }
});
