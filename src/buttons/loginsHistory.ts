import { loadTelegramSummary } from '../services/accountSummary';
import { handleTelegram } from '../events/telegram';
import prisma from '@/services/prisma';
import { Client, PollResponse } from '@/types/client';

export async function loginsHistory(client: Client, data: PollResponse) {
	if (data.chatId !== data.sender) return;
	const telegram = await loadTelegramSummary(client.wid, data.sender);
	if (telegram.state === 'linked') await handleTelegram(client, { from: data.sender, body: '/historicotelegram' });
	else if (telegram.state === 'unavailable') await client.sendText(data.chatId, 'Histórico Telegram temporariamente indisponível.');
	const user = await prisma.user.findFirst({
		where: {
			wid: data.sender,
			bot: {
				wid: client.wid,
			},
		},
		include: {
			affiliateds: true,
			loginsHistory: true,
		},
	});

	if (user === null) {
		client.sendText(data.chatId, 'Você não está cadastrado no sistema.');
		return;
	}

	if (user.loginsHistory.length === 0) {
		if (telegram.state !== 'linked') await client.sendText(data.chatId, 'Você não possui compras no histórico local do WhatsApp.');
		return;
	}

	const history = user.loginsHistory
		.map((item) => {
			return (
				`*Login:* ${item.loginName}\n` +
				`*Valor:* ${item.loginPrice}\n` +
				`*Usuário:* ${item.loginUser}\n` +
				`*Senha:* ${item.loginPassword}\n` +
				`*Informações adicionais:* ${item.loginAdditional}`
			);
		})
		.join('\n\n');

	client.sendText(data.chatId, `*📋 Histórico de logins comprados no WhatsApp:*\n\n${history}`);
}
