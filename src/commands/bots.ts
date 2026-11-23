import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client } from '@/types/client';
import prisma from '@/services/prisma';

export async function commandShowBots(client: Client, message: wppconnect.Message) {
	const bots = await prisma.bot.findMany({
		select: {
			wid: true,
			owner: true,
			expireAt: true,
			name: true,
			admins: {
				select: {
					wid: true,
				},
			},
			_count: {
				select: {
					users: true,
				},
			},
		},
	});

	let text = '*Lista de Todos os Bots:*\n\n';

	for (const bot of bots) {
		const admins = bot.admins.map(({ wid }) => wid.replace(/\D/g, '')).join(', ');

		text +=
			`*Nome:* ${bot.name}\n` +
			`*Número:* ${bot.wid.replace(/\D/g, '')}\n` +
			`*Dono:* ${bot.owner.replace(/\D/g, '')}\n` +
			`*Expira em:* ${bot.expireAt?.toLocaleString()}\n` +
			`*Usuários:* ${bot._count.users}\n` +
			`*Admins:* ${admins}\n\n`;
	}

	client.sendText(message.from, text.trim());
}
