import { createHash } from 'node:crypto';
import type { Client, PollResponse, Command } from '../types/client';
import { loadTelegramSummary } from '../services/accountSummary';
import { getTelegramCatalog, telegramEnabled, telegramPhone, TelegramApiError, telegramApi } from '../services/telegramApi';
import { runWalletOperation, getWalletOperation } from '../services/telegramWallet';

type MessageSink = { wid?: string; sendText: (to: string, text: string) => Promise<unknown> };

const quotes = new Map<string, { expires: number; offset: number; products: Map<string, { name: string; price: number }> }>();
const busy = new Set<string>();
const key = (client: Client, sender: string, id: string) => `${client.wid}:${sender}:${id.split('_').pop()}`;
const money = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? `R$ ${v.toFixed(2)}` : 'indisponível';
const safe = (v: unknown) => String(v ?? '').slice(0, 1500);
const operationId = (client: Client, phone: string, id: string, kind: string) => createHash('sha256').update(JSON.stringify([client.wid, phone, id, kind])).digest('hex');

async function walletActive(client: Client, sender: string) {
 const summary = await loadTelegramSummary(client.wid, sender);
 if (summary.state === 'unavailable') throw new TelegramApiError(503);
 return summary.state === 'linked' ? summary : null;
}

async function failure(client: MessageSink, to: string, error: unknown, id?: string) {
 const e = error instanceof TelegramApiError ? error : new TelegramApiError(502);
 const text = e.status === 404 || e.reason === 'NOT_CONFIGURED' ? 'O servidor Telegram precisa ser atualizado para permitir compras e recargas com o saldo compartilhado.'
  : e.uncertain ? `Não foi possível confirmar a operação. Não faça outra compra ou recarga agora. Consulte /operacaotelegram ${id} ou contate o suporte.`
  : e.status === 402 ? 'Saldo insuficiente na sua conta Telegram.'
  : e.status === 409 ? 'Operação pendente ou dados alterados. Consulte seu histórico e atualize a lista antes de continuar.'
  : 'O serviço do saldo compartilhado está indisponível. Tente novamente mais tarde. Nenhum saldo local será usado.';
 await client.sendText(to, text);
}

async function operationResult(client: MessageSink, to: string, data: any) {
 if (data?.status !== 'DONE') {
  const rejected = data?.status === 'REJECTED';
  await client.sendText(to, rejected
   ? (data.erro_status === 402 ? 'Saldo insuficiente na sua conta Telegram.' : 'Operação recusada. Atualize a lista ou confira o valor da recarga.')
   : `Operação em análise. Não faça outra compra ou recarga agora. Consulte /operacaotelegram ${safe(data?.operacao)}`);
  return;
 }
 const result = data.resultado;
 if (Array.isArray(result?.entregues)) {
  for (const item of result.entregues) {
   await client.sendText(to, `*✅ COMPRA REALIZADA*\nProduto: ${safe(item.nome)}\nValor: ${money(item.valor)}\n\nUsuário/acesso: ${safe(item.email)}\nSenha/código: ${safe(item.senha)}\n${safe(item.descricao)}`);
  }
  await client.sendText(to, `${result.entregues.length ? 'Compra registrada no mesmo cadastro do Telegram.' : 'Nenhum produto entregue. Consulte o saldo e o histórico antes de tentar novamente.'}\n*Seu saldo:* ${money(result.saldo)}`);
 } else if (typeof result?.copia === 'string' && result.id_pag != null) {
  await client.sendText(to, `*💸 PIX — SALDO COMPARTILHADO*\nValor da recarga: ${money(result.valor)}\nTotal a pagar: ${money(result.total)}\n\n${result.copia}\n\nApós aprovação, o crédito entra no mesmo saldo do Telegram e WhatsApp.\nConsultar: /statuspix ${safe(result.id_pag)}`);
 } else throw new TelegramApiError(502);
}

export async function showTelegramLogins(client: Client, data: PollResponse, offset = 0): Promise<boolean> {
 if (!telegramEnabled(client.wid)) return false;
 if (data.chatId !== data.sender) { await client.sendText(data.chatId, 'Use a conversa privada para comprar.'); return true; }
 try {
  const account = await walletActive(client, data.sender);
  if (!account) return false;
  const catalog = await getTelegramCatalog();
  if (!Array.isArray(catalog?.produtos)) throw new TelegramApiError(502);
  const available = catalog.produtos.filter((p: any) => typeof p.nome === 'string' && typeof p.preco === 'number' && Number.isFinite(p.preco) && p.preco > 0 && Number.isInteger(p.estoque) && p.estoque > 0);
  if (!available.length) { await client.sendText(data.sender, 'Sem produtos em estoque no momento.'); return true; }
  offset = Math.min(Math.max(0, offset), Math.floor((available.length - 1) / 8) * 8);
  const products = new Map<string, { name: string; price: number }>();
  for (const p of available.slice(offset, offset + 8)) products.set(`TG • ${p.nome} — ${money(p.preco)}`, { name: p.nome, price: p.preco });
  const options = [...products.keys()];
  if (offset + 8 < available.length) options.push('TG • Próximo');
  if (offset > 0) options.push('TG • Anterior');
  const sent = await client.sendPollMessage(data.sender, `*Seu saldo: ${money(account.balance)}*\nConta vinculada ao Telegram. Selecione um produto.`, options, { selectableCount: 1 });
  for (const [id, quote] of quotes) if (quote.expires < Date.now()) quotes.delete(id);
  quotes.set(key(client, data.sender, sent.id), { expires: Date.now() + 15 * 60 * 1000, offset, products });
 } catch (error) { await failure(client, data.sender, error); }
 return true;
}

export async function responseTelegramLogin(client: Client, data: PollResponse): Promise<boolean> {
 if (!telegramEnabled(client.wid)) return false;
 if (data.chatId !== data.sender) return true;
 const activeKey = `${client.wid}:${data.sender}`;
 if (busy.has(activeKey)) { await client.sendText(data.sender, 'Aguarde a operação anterior terminar.'); return true; }
 let id: string | undefined;
 busy.add(activeKey);
 try {
  if (!await walletActive(client, data.sender)) return false;
  const quote = quotes.get(key(client, data.sender, data.msgId.id));
  if (!quote || quote.expires < Date.now()) { await showTelegramLogins(client, data); return true; }
  const choice = data.selected?.added || '';
  if (choice === 'TG • Próximo' || choice === 'TG • Anterior') { await showTelegramLogins(client, data, quote.offset + (choice === 'TG • Próximo' ? 8 : -8)); return true; }
  const product = quote.products.get(choice);
  if (!product) return true;
  const phone = telegramPhone(data.sender);
  id = operationId(client, phone, data.msgId.id, 'comprar');
  const result = await runWalletOperation(phone, id, 'comprar', { produto: product.name, preco: product.price });
  await operationResult(client, data.sender, result);
 } catch (error) { await failure(client, data.sender, error, id); }
 finally { busy.delete(activeKey); }
 return true;
}

export async function tryTelegramPix(client: Client, message: { from: string; id?: string }, command: Command): Promise<boolean> {
 if (!telegramEnabled(client.wid)) return false;
 let id: string | undefined;
 try {
  if (!await walletActive(client, message.from)) return false;
  const amount = Number(command.args[0]?.replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(?:[.,]\d{1,2})?$/.test(command.args[0] || '')) { await client.sendText(message.from, 'Informe o valor. Exemplo: /pix 10'); return true; }
  if (!message.id) throw new TelegramApiError(400);
  const phone = telegramPhone(message.from);
  id = operationId(client, phone, message.id, 'pix');
  const result = await runWalletOperation(phone, id, 'pix', { valor: amount });
  await operationResult(client, message.from, result);
 } catch (error) { await failure(client, message.from, error, id); }
 return true;
}

export async function walletStatus(client: MessageSink, from: string, kind: string, id: string) {
 try {
  const phone = telegramPhone(from);
  if (kind === '/operacaotelegram') await operationResult(client, from, await getWalletOperation(phone, id));
  else {
   if (!id || id.length > 200) throw new TelegramApiError(400);
   const result = await telegramApi(`/api/whatsapp/v1/clientes/${phone}/pix/${encodeURIComponent(id)}/status`);
   await client.sendText(from, `${result.pago ? '✅ Pagamento aprovado.' : '⏳ Pagamento ainda não confirmado.'}\n*Seu saldo:* ${money(result.saldo)}`);
  }
 } catch (error) { await failure(client, from, error, id); }
}
