import { loadTelegramSummary } from '../services/accountSummary';
import prisma from '@/services/prisma';
import { Client, PollResponse } from '@/types/client';

export async function addBalance(client: Client, data: PollResponse) {
 if (data.chatId !== data.sender) return;
 const account = await loadTelegramSummary(client.wid, data.sender);
 if (account.state !== 'unlinked') {
  await client.sendText(data.sender, account.state === 'linked'
   ? '*💸 Adicionar saldo*\nUse /pix VALOR. Exemplo: /pix 10\nApós aprovação, o crédito entra no mesmo saldo do Telegram e WhatsApp.'
   : 'Saldo compartilhado temporariamente indisponível. Tente novamente mais tarde.');
  return;
 }
	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid!,
		}
	});

	client.sendText(data.chatId, `${bot!.textPix}\n\nUse o comando: */pix [VALOR]*\n\nExemplo: */pix 10*`.trim());
}