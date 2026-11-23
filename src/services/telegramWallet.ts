import { telegramApi, TelegramApiError } from './telegramApi';

export async function getWalletOperation(phone: string, id: string) {
 if (!/^[a-f0-9]{64}$/.test(id)) throw new TelegramApiError(400);
 return telegramApi(`/api/whatsapp/v1/clientes/${phone}/operacoes/${id}`);
}

export async function runWalletOperation(phone: string, id: string, kind: 'comprar' | 'pix', payload: Record<string, unknown>) {
 try {
  return await telegramApi(`/api/whatsapp/v1/clientes/${phone}/${kind}`, { body: { ...payload, operacao: id } });
 } catch (error) {
  if (!(error instanceof TelegramApiError) || !error.uncertain) throw error;
  // Consulta pelo mesmo ID: nunca repete uma compra ou geração de pagamento automaticamente.
  try { return await getWalletOperation(phone, id); }
  catch { throw new TelegramApiError(0, true); }
 }
}
