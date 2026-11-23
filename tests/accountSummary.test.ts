import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { accountSummaryText, loadTelegramSummary } from '../src/services/accountSummary';
const { test }: typeof import('node:test') = createRequire(__filename)('node:test');

test('conta vinculada mostra saldo e compras do Telegram sem copiar para o saldo local', async () => {
 const env = { ...process.env }; const originalFetch = globalThis.fetch;
 try {
  process.env.TELEGRAM_ENABLED = 'true'; process.env.TELEGRAM_BOT_PHONE = '5511888888888';
  process.env.WHATSAPP_API_KEY = 'test-key'; process.env.TELEGRAM_BASE_URL = 'https://example.test';
  globalThis.fetch = async () => new Response(JSON.stringify({ saldo: 92.5, total_compras: 1 }));
  const remote = await loadTelegramSummary('5511888888888@c.us', '5511999999999@c.us');
  const text = accountSummaryText({ balance: 0, purchases: 0 }, remote);
  assert.ok(text.includes('Seu saldo:* R$ 92.50'));
  assert.ok(text.includes('Compras realizadas:* 1'));
  assert.ok(!text.includes('R$ 0.00')); 
  globalThis.fetch = async () => new Response('{}', { status: 503 });
  const failed = await loadTelegramSummary('5511888888888@c.us', '5511999999999@c.us');
  assert.equal(failed.state, 'unavailable');
  assert.ok(accountSummaryText({ balance: 0, purchases: 0 }, failed).includes('indisponíveis'));
  assert.ok(!accountSummaryText({ balance: 0, purchases: 0 }, failed).includes('Compras realizadas no Telegram:* 0'));
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  assert.equal((await loadTelegramSummary('5511888888888@c.us', '5511999999999@c.us')).state, 'unlinked');
 } finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
 }
});
