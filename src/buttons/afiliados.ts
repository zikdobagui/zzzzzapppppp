import prisma from '@/services/prisma';
import { Client, PollResponse } from '@/types/client';

export async function affiliateds(client: Client, data: PollResponse) {
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

	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid,
		},
	});

	if (user === null) {
		client.sendText(data.chatId, 'Você não está cadastrado no sistema.');
		return;
	}

	const phone = user.wid.replace(/\D/g, '');
	const phoneBot = client.wid?.replace(/\D/g, '');

	const affiliateds = user.affiliateds.reduce(
		(acc, item) => {
			const phone = item.wid.replace(/\D/g, '');
			const text = `*@${phone}*\n`;
			acc.text += text;
			acc.list.push(item.wid as never);

			return acc;
		},
		{ text: '', list: [] }
	);

	const linkAffiliated = `https://wa.me/${phoneBot}?text=${encodeURIComponent(
		`/afiliado ${phone}`
	)}`;

	const text =
		'*👤 Sistema de Afiliados:*\n\n' +
		`${bot?.textAffiliateds}\n\n` +
		`*🔗 Link:* ${linkAffiliated}\n\n` +
		'*Usuários Afiliados:*\n' +
		affiliateds.text;

	await client.sendText(data.chatId, text, {
		linkPreview: false,
	});
}
