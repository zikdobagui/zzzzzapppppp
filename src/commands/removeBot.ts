import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';
import { clients } from '..';
import { rmdirSync } from 'fs';

export async function commandRemoveBot(client: Client, message: wppconnect.Message, command: Command) {
	const [phoneBot] = command.args;

	if (!phoneBot) {
		client.sendText(
			message.from,
			'Forma de uso: /removerbot [NUMERO DO BOT]\n\nExemplo: /removerbot 5511999999999'
		);
		return;
	}

	const bot = await prisma.bot.findUnique({
		where: {
			wid: `${phoneBot}@c.us`,
		},
	});

	if (!bot) {
		client.sendText(message.from, `Bot *${phoneBot}* não encontrado!`);
		return;
	}

	await prisma.bot.delete({
		where: {
			id: bot.id,
		}
	});
	clients[bot.wid]?.close();
	delete clients[bot.wid];

	rmdirSync(`./tokens/${bot.name}`, { recursive: true });

	await client.sendText(message.from, `Bot *${phoneBot}* removido com sucesso.`);
}
