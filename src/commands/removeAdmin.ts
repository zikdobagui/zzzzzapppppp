import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandRemoveAdmin(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const number = command.args.join('').replace(/\D/g, '');

	if (!number) {
		client.sendText(
			message.from,
			'Número invalido ou não informado. Use: /removeradmin 5511999999999'
		);
		return;
	}

	const admin = await prisma.admins.findFirst({
		where: {
			wid: `${number}@c.us`,
			bot: {
				wid: client.wid!,
			},
		},
	});

	if (!admin) {
		client.sendText(message.from, `O número *${number}* não é um administrador.`);
		return;
	}

	await prisma.admins.delete({
		where: {
			id: admin.id,
			bot: {
				wid: client.wid!,
			},
		},
	});

	await client.sendText(message.from, `O número *${number}* foi removido como administrador.`);
	notifyAdmin(client, `Admin ${message.author || message.from} removeu o número *${number}* como administrador.`);
}
