import { walletStatus } from '../buttons/telegramWallet';
import { TelegramApiError, telegramEnabled, telegramPhone, getTelegramClient, getTelegramHistory, getTelegramCatalog, linkTelegram } from '../services/telegramApi';

interface TelegramClient { wid?: string; sendText: (to: string, text: string) => Promise<unknown>; sendPollMessage?: (to: string, text: string, options: string[], settings: { selectableCount: number }) => Promise<unknown> }
const pending = new Map<string, number>();
const busy = new Set<string>();
const skipped = new Set<string>();
export const TELEGRAM_STORE_OPTION = '➡️ Não tenho Telegram · ir para a loja';
export const TELEGRAM_HELP_OPTION = '🆘 Preciso de ajuda';

export async function inviteTelegram(client: TelegramClient, to: string) {
 const key = `${client.wid}:${to}`;
 for (const [entry, deadline] of pending) if (deadline < Date.now()) pending.delete(entry);
 pending.set(key, Date.now() + 5 * 60 * 1000);
 let destination = 'o bot da nossa loja no Telegram ou o site';
 const configuredUrl = process.env.TELEGRAM_BOT_URL?.trim();
 if (configuredUrl && /^https:\/\/t\.me\/[a-zA-Z0-9_]+$/.test(configuredUrl)) destination = configuredUrl;
 await client.sendText(to,
  '*🔗 VINCULE SUA CONTA DO TELEGRAM*\n━━━━━━━━━━━━━━━━━━━━\n\n' +
  'Já é cliente no Telegram? Vincule seu cadastro para consultar seus dados e saldo aqui no WhatsApp.\n\n' +
  `1️⃣ Abra ${destination}\n` +
  '2️⃣ Toque em *MEU PERFIL → 🔗 VINCULAR WHATSAPP*\n' +
  '3️⃣ *Mande aqui o código que aparecer no seu perfil.*\n\n' +
  'Cada cliente tem seu próprio código. Vou aguardar o seu por 5 minutos.');
 if (client.sendPollMessage) {
  try {
   await client.sendPollMessage(to, '🔗 Vincular com o Telegram\nSelecione uma opção ou envie seu código nesta conversa.', [TELEGRAM_STORE_OPTION, TELEGRAM_HELP_OPTION], { selectableCount: 1 });
   return;
  } catch { /* Orientação por texto continua disponível se a enquete falhar. */ }
 }
 await client.sendText(to, 'Não tem Telegram? Digite /loja para continuar.\nPrecisa de ajuda? Digite /ajudavinculo.');
}
const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? `R$ ${value.toFixed(2)}` : 'Não informado';
const safe = (value: unknown) => value == null ? 'Não informado' : String(value).replace(/[\r\n\x00-\x1f]/g, ' ').slice(0, 300);
const help = '*Telegram*\n\n/vincular CODIGO — cole o código do Meu Perfil do Telegram/site.\n/saldotelegram — saldo e cadastro\n/historicotelegram — compras e pagamentos\n/catalogotelegram — preços e disponibilidade\n/cancelar — cancelar envio do código\n\nContas vinculadas usam o saldo único do Telegram.';

export function telegramSensitive(botWid: string | undefined, from: string, body?: string) {
 return /^\/vincular(?:\s|$)/i.test(body?.trim() || '') || pending.has(`${botWid}:${from}`);
}

export async function handleTelegram(client: TelegramClient, message: { from: string; body?: string; isGroupMsg?: boolean; fromMe?: boolean }) {
 const text = message.body?.trim() || '';
 const [rawCommand, ...args] = text.split(/\s+/);
 const command = rawCommand.toLowerCase();
 const commands = ['/telegram', '/vincular', '/saldotelegram', '/historicotelegram', '/catalogotelegram', '/cancelar', '/loja', '/ajudavinculo', '/statuspix', '/operacaotelegram'];
 const key = `${client.wid}:${message.from}`;
 const expires = pending.get(key);
 if (expires && expires < Date.now()) pending.delete(key);
 if (!commands.includes(command) && (!pending.has(key) || text.startsWith('/'))) {
  // Ao abrir a conversa/menu, consulta o vínculo persistido no Telegram.
  // Comandos locais continuam disponíveis; não se tenta adivinhar o formato de códigos.
  if ((text.startsWith('/') && command !== '/menu') || skipped.has(key) || message.fromMe || message.isGroupMsg || !telegramEnabled(client.wid)
   || !/@(?:c\.us|s\.whatsapp\.net)$/.test(message.from)) return false;
  if (busy.has(key)) return true;
  busy.add(key);
  let needsLink = false;
  try {
   await getTelegramClient(telegramPhone(message.from));
  } catch (error) {
   if (error instanceof TelegramApiError && error.status === 404) needsLink = true;
   else {
    if (error instanceof TelegramApiError && error.status === 403) {
     await client.sendText(message.from, 'Cadastro Telegram bloqueado. Contate o suporte.');
     return true;
    }
    // O convite continua visível mesmo quando a consulta está indisponível.
    // Nenhum vínculo é confirmado sem resposta da API.
    needsLink = true;
   }
  } finally { busy.delete(key); }
  if (!needsLink) return false;
  return handleTelegram(client, { ...message, body: '/vincular' });
 }
 if (message.fromMe) return true;
 if (!telegramEnabled(client.wid)) {
  if (commands.includes(command) && command !== '/cancelar') await client.sendText(message.from, 'Integração Telegram indisponível neste bot.');
  return commands.includes(command);
 }
 if (message.isGroupMsg || !/@(?:c\.us|s\.whatsapp\.net|lid)$/.test(message.from)) {
  await client.sendText(message.from, 'Use estes comandos em conversa privada com o bot oficial.');
  return true;
 }
 if (busy.has(key)) { await client.sendText(message.from, 'Aguarde a consulta anterior terminar.'); return true; }
 busy.add(key);
 try {
  const phone = telegramPhone(message.from);
  if (command === '/statuspix' || command === '/operacaotelegram') await walletStatus(client, message.from, command, args[0] || '');
  else if (command === '/cancelar') { pending.delete(key); await client.sendText(message.from, 'Envio do código cancelado.'); }
  else if (command === '/loja') { pending.delete(key); skipped.add(key); return false; }
  else if (command === '/ajudavinculo') {
   await client.sendText(message.from, 'Abra o bot da loja no Telegram ou o site, entre em Meu Perfil e procure Vincular WhatsApp. Copie o código e envie aqui. Se não encontrar, digite /loja e selecione Suporte no menu. Para seguir sem vincular, digite /loja.');
  }
  else if (command === '/telegram') { skipped.delete(key); await inviteTelegram(client, message.from); await client.sendText(message.from, help); }
  else if (command === '/catalogotelegram') {
   const catalog = await getTelegramCatalog();
   if (!Array.isArray(catalog?.produtos)) throw new TelegramApiError(502);
   await sendLines(client, message.from, '*Catálogo Telegram*', catalog.produtos.map((p: any) => `${safe(p.nome)} — ${money(p.preco)} — Estoque: ${safe(p.estoque)}\n${safe(p.descricao)}`));
   await client.sendText(message.from, 'Disponibilidade consultada agora, sem reserva. Para comprar, acesse o Telegram/site.');
  } else if (command === '/saldotelegram') {
   const user = await getTelegramClient(phone);
   await client.sendText(message.from, formatClient(user));
  } else if (command === '/historicotelegram') {
   const history = await getTelegramHistory(phone);
   if (!Array.isArray(history?.compras) || !Array.isArray(history?.pagamentos)) throw new TelegramApiError(502);
   for (const [title, items] of [['Compras Telegram', history.compras], ['Pagamentos Telegram', history.pagamentos]] as const) {
    await sendLines(client, message.from, `*${title}*`, items.map((item: any) => `${safe(item.data)} — ${safe(item.servico)} / ${safe(item.produto)} — ${money(item.valor)}`));
   }
  } else {
   const code = command === '/vincular' ? args.join(' ') : text;
   if (!code) {
    skipped.delete(key);
    await inviteTelegram(client, message.from);
   } else {
    pending.delete(key);
    if (code.length > 256 || /\s/.test(code)) throw new TelegramApiError(400);
    await linkTelegram(phone, code);
    let user;
    try { user = await getTelegramClient(phone); }
    catch {
     await client.sendText(message.from, '✅ Código validado e cadastro vinculado. Não foi possível carregar seus dados agora. Use /saldotelegram para consultar, sem reenviar o código.');
     return true;
    }
    await client.sendText(message.from, `✅ Código validado!\n\n${formatClient(user)}\n\nPara consultar seu histórico: /historicotelegram`);
   }
  }
 } catch (error) {
  // Não encaminhar resposta remota, mensagem original ou código aos logs/suporte.
  const e = error instanceof TelegramApiError ? error : new TelegramApiError(502);
  const messages: Record<number, string> = {
   400: 'Código ou número inválido. Use /vincular CODIGO em conversa privada. Se necessário, tente novamente após resolver o número da conta.',
   401: 'A integração precisa de ajuste nas chaves de acesso. Contate o suporte.',
   403: 'Cadastro Telegram bloqueado. Contate o suporte.',
   404: 'Cadastro não vinculado ou rota indisponível. Use /vincular CODIGO; se já vinculou, contate o suporte.',
   409: 'Código inválido, expirado ou já utilizado, ou número já vinculado. Consulte /saldotelegram e confira Meu Perfil no Telegram.',
   503: 'Integração Telegram não configurada ou temporariamente indisponível.',
  };
  if (e.reason === 'NOT_CONFIGURED') {
   await client.sendText(message.from, 'O serviço de vínculo ainda não foi ativado. Não foi possível validar seu código. Entre em contato com o suporte ou digite /loja para continuar sem vincular.');
   return true;
  }
  await client.sendText(message.from, e.uncertain ? 'Não foi possível confirmar o vínculo. Não reenvie o código agora: consulte /saldotelegram primeiro e confira Meu Perfil no Telegram.' : messages[e.status] || 'Não foi possível consultar o Telegram agora. Tente novamente mais tarde.');
 } finally { busy.delete(key); }
 return true;
}

function formatClient(user: any) {
 return `*Cadastro Telegram*\nCliente: ${safe(user.cliente_id)}\nUsuário: ${safe(user.username)}\nWhatsApp: ${safe(user.whatsapp)}\nSaldo: ${money(user.saldo)}\nCompras: ${safe(user.total_compras)}`;
}

async function sendLines(client: TelegramClient, to: string, title: string, lines: string[]) {
 if (!lines.length) { await client.sendText(to, `${title}\nNenhum registro.`); return; }
 let chunk = title;
 for (const line of lines) {
  if (chunk.length + line.length > 3000) { await client.sendText(to, chunk); chunk = title; }
  chunk += `\n\n${line}`;
 }
 await client.sendText(to, chunk);
}
