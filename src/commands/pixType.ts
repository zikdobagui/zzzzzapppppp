import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandPixType(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	let [type] = command.args;

	if (type !== 'auto' && type !== 'manual' && type !== 'automatico') {
		client.sendText(
			message.from,
			'Você precisa informar o tipo de pix, "auto" ou "manual". Exemplo: /pixtipe manual'
		);
		return;
	}

	type = type === 'automatico' ? 'auto' : type;

	await prisma.bot.update({
		where: {
			wid: client.wid!,
		},
		data: {
			pixType: type,
		},
	});

	await client.sendText(message.from, `Tipo de pix alterado para "${type}"`);
	notifyAdmin(client, `Admin ${message.author || message.from} alterou o tipo de pix para "${type}"`);
}
