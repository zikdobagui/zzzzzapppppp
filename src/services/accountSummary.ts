import { getTelegramClient, TelegramApiError, telegramEnabled, telegramPhone } from './telegramApi';

export type TelegramSummary =
 | { state: 'linked'; balance: number; purchases: number }
 | { state: 'unlinked' | 'unavailable' };

export async function loadTelegramSummary(botWid: string | undefined, sender: string): Promise<TelegramSummary> {
 if (!telegramEnabled(botWid)) return { state: 'unlinked' };
 try {
  const user = await getTelegramClient(telegramPhone(sender));
  if (typeof user?.saldo !== 'number' || !Number.isFinite(user.saldo)
   || !Number.isInteger(user.total_compras) || user.total_compras < 0) throw new TelegramApiError(502);
  return { state: 'linked', balance: user.saldo, purchases: user.total_compras };
 } catch (error) {
  if (error instanceof TelegramApiError && error.status === 404) return { state: 'unlinked' };
  return { state: 'unavailable' };
 }
}

export function accountSummaryText(local: { balance: number; purchases: number }, remote: TelegramSummary) {
 const localText = `*◆ Saldo para compras no WhatsApp:* R$ ${local.balance.toFixed(2)}\n*◆ Compras no WhatsApp:* ${local.purchases}\n`;
 if (remote.state === 'linked') {
  return `*◆ Conta Telegram vinculada*\n*◆ Seu saldo:* R$ ${remote.balance.toFixed(2)}\n*◆ Compras realizadas:* ${remote.purchases}\n`;
 }
 if (remote.state === 'unavailable') return '*◆ Saldo e compras temporariamente indisponíveis*\n';
 return localText;
}
