import { loadTelegramSummary, accountSummaryText } from '../services/accountSummary';
import prisma from '@/services/prisma';
import { Client, PollResponse } from '@/types/client';

export async function infoUser(client: Client, data: PollResponse) {
	if (data.chatId !== data.sender) return;
	const user = await prisma.user.findFirst({
		where: {
			wid: data.sender,
			bot: {
				wid: client.wid,
			},
		},
		include: {
			_count: {
				select: {
					loginsHistory: true,
				},
			},
			gifts: true,
		},
	});

	if (user === null) {
		client.sendText(data.chatId, 'Você não está cadastrado no sistema.');
		return;
	}

	const phone = user.wid.replace(/\D/g, '');
	const giftTotal = user.gifts.reduce((acc, { amount }) => acc + amount, 0);

	const telegram = await loadTelegramSummary(client.wid, data.sender);
	const summary = accountSummaryText({ balance: user.balance, purchases: user._count.loginsHistory }, telegram);
	const text =
		'*👤 Informações do usuário:*\n\n' +
		`*📱 Número:* ${phone}\n` +
		summary +
		(telegram.state === 'unlinked' ? `*🎁 Gifts Resgatados:* R$ ${giftTotal.toFixed(2)}` : '');

	const options = ['🫂 Afiliados', '🧾 Histórico de Logins'];
	if (telegram.state === 'linked') options.push('🧾 Histórico Telegram');
	await client.sendPollMessage(data.chatId, text, options, {
		selectableCount: 1,
	});
}
