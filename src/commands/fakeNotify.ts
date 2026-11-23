import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandFakeNotify(client: Client, message: wppconnect.Message) {
	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid!,
		},
	});

	if (!bot) {
		throw new Error('Bot not found');
	}

	const fakeNotify = !bot.fakeNotify;

	await prisma.bot.update({
		where: {
			wid: client.wid!,
		},
		data: {
			fakeNotify,
		},
	});

	await client.sendText(
		message.from,
		`O modo de *Notificações Fake* foi ${fakeNotify ? 'ativado' : 'desativado'} com sucesso.`
	);
	notifyAdmin(
		client,
		`O modo de *Notificações Fake* foi ${fakeNotify ? 'ativado' : 'desativado'} por *${
			message.author || message.from
		}*`
	);
}
