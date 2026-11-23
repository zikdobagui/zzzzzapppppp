import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandBlockBot(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const phoneBot = command.args.join(' ').replace(/\D/g, '');

	if (!phoneBot) {
		client.sendText(
			message.from,
			'Você precisa informar o número do bot para bloquear ou desbloquear. Exemplo: /block 5511999999999'
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

	await prisma.bot.update({
		where: {
			wid: `${phoneBot}@c.us`,
		},
		data: {
			block: !bot?.block,
		},
	});

	await client.sendText(
		message.from,
		`Bot ${phoneBot} ${bot?.block ? 'desbloqueado' : 'bloqueado'} com sucesso.`
	);
	notifyAdmin(
		client,
		`Dono ${message.author || message.from} ${
			bot?.block ? 'desbloqueou' : 'bloqueou'
		} o bot ${phoneBot}`
	);
}
