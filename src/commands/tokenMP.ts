import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandTokenMP(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const tokenMp = command.args.join(' ');

	if (!tokenMp) {
		client.sendText(message.from, 'Você precisa informar o token do Mercado Pago.\n\nExemplo: /tokenMP 1234567890');
		return;
	}

	await prisma.bot.update({
		where: {
			wid: client.wid!,
		},
		data: {
			mercadoPagoToken: tokenMp,
		},
	});

	await client.sendText(message.from, `Token do Mercado Pago atualizado com sucesso\n\nToken: *${tokenMp}*`);
	notifyAdmin(client, `Admin ${message.author || message.from} atualizou o token do Mercado Pago\n\nToken: *${tokenMp}*`);
}
