export class TelegramApiError extends Error {
 constructor(public status: number, public uncertain = false, public reason?: 'NOT_CONFIGURED') {
  super(`Falha na integração Telegram (${status}).`);
 }
}

export function telegramEnabled(botWid?: string) {
 const phone = process.env.TELEGRAM_BOT_PHONE?.trim() || process.env.BOT_PHONE?.trim();
 return process.env.TELEGRAM_ENABLED === 'true' && Boolean(phone) && botWid === `${phone}@c.us`;
}

// LIDs não são números de telefone. Resolva-os pela plataforma antes de chamar.
export function telegramPhone(address: string): string {
 const match = /^([1-9]\d{9,14})(?::\d+)?@(?:c\.us|s\.whatsapp\.net)$/.exec(address);
 if (!match) throw new TelegramApiError(400);
 return match[1];
}

export async function telegramApi(path: string, options: { body?: Record<string, unknown>; catalogo?: boolean } = {}): Promise<any> {
 const key = (options.catalogo ? process.env.WHATSAPP_CATALOG_API_KEY : process.env.WHATSAPP_API_KEY)?.trim();
 const base = process.env.TELEGRAM_BASE_URL?.trim();
 if (!key || !base) throw new TelegramApiError(503, false, 'NOT_CONFIGURED');
 let url: URL;
 try {
  url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
  url = new URL(path, url);
 } catch { throw new TelegramApiError(503); }
 let response: Response;
 try {
  response = await fetch(url, {
   method: options.body ? 'POST' : 'GET',
   headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
   body: options.body ? JSON.stringify(options.body) : undefined,
   signal: AbortSignal.timeout(15000), redirect: 'error',
  });
 } catch { throw new TelegramApiError(0, Boolean(options.body)); }
 if (!response.ok) {
  // Apenas a rejeição explícita de configuração garante que o vínculo não foi executado.
  // Não repasse o corpo remoto, pois pode conter dados sensíveis.
  if (response.status === 503) {
   let data: any;
   try { data = await response.json(); } catch { /* Resposta perdida permanece incerta. */ }
   const reason = typeof data?.erro === 'string'
    ? data.erro.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : '';
   if (reason === 'integracao nao configurada' || reason === 'operacoes compartilhadas nao configuradas') throw new TelegramApiError(503, false, 'NOT_CONFIGURED');
  }
  throw new TelegramApiError(response.status, Boolean(options.body) && response.status >= 500);
 }
 try { return await response.json(); }
 catch { throw new TelegramApiError(502, Boolean(options.body)); }
}

export const getTelegramClient = (phone: string) => telegramApi(`/api/whatsapp/v1/clientes/${phone}`);
export const getTelegramHistory = (phone: string) => telegramApi(`/api/whatsapp/v1/clientes/${phone}/historico`);
export const getTelegramCatalog = () => telegramApi('/api/whatsapp/v1/produtos', { catalogo: true });

export async function linkTelegram(phone: string, codigo: string) {
 try {
  const result = await telegramApi('/api/whatsapp/v1/vincular', { body: { codigo, whatsapp: phone } });
  if (result?.vinculado !== true) throw new TelegramApiError(502, true);
  return result;
 } catch (error) {
  if (!(error instanceof TelegramApiError) || !error.uncertain) throw error;
  // Uma resposta perdida pode ter consumido o código. Consulte, nunca repita o POST.
  try { return await getTelegramClient(phone); }
  catch { throw new TelegramApiError(0, true); }
 }
}
