import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandTokenMPMaster(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const tokenMp = command.args.join(' ');

	if (client.wid?.replace(/\D/g, '') !== process.env.BOT_PHONE) {
		client.sendText(message.from, 'Bot não é o principal.');
		return;
	}

	if (!tokenMp) {
		client.sendText(
			message.from,
			'Você precisa informar o token do Mercado Pago.\n\nExemplo: /tokenmpmaster 1234567890'
		);
		return;
	}

	await prisma.botMaster.update({
		where: {
			wid: client.wid!,
		},
		data: {
			mercadoPagoToken: tokenMp,
		},
	});

	await client.sendText(
		message.from,
		`Token do Mercado Pago atualizado com sucesso\n\nToken: *${tokenMp}*`
	);
	notifyAdmin(
		client,
		`Admin ${
			message.author || message.from
		} atualizou o token do Mercado Pago do bot master\n\nToken: *${tokenMp}*`
	);
}
