import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandAddAdmin(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const number = command.args.join(' ').replace(/\D/g, '');

	if (!number) {
		client.sendText(
			message.from,
			'Número invalido ou não informado. Use: /addadmin 5511999999999'
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
	if (admin) {
		client.sendText(message.from, `O número *${number}* já é um administrador.`);
		return;
	}

	await prisma.admins.create({
		data: {
			wid: `${number}@c.us`,
			bot: {
				connect: {
					wid: client.wid!,
				},
			},
		},
	});

	client.sendText(message.from, `O número *${number}* foi adicionado como administrador.`);
	notifyAdmin(client, `O número *${number}* foi adicionado como administrador.`);
}
