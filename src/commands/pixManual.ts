import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandPixManual(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const [key, additional] = command.args.join(' ').split('|');

	if (!key) {
		client.sendText(message.from, 'Você precisa informar a chave pix e caso queira colocar alguma informação adicional.\n\nExemplo: /pixmanual 1234567890|Informação adicional');
		return;
	}

	await prisma.bot.update({
		where: {
			wid: client.wid!,
		},
		data: {
			pixManualKey: key,
			pixManualAdditional: additional,
		},
	});

	await client.sendText(message.from, `Chave pix manual atualizada com sucesso\n\nChave: *${key}*\nInformação adicional: *${additional}*`);
	notifyAdmin(client, `Admin ${message.author || message.from} atualizou a chave pix manual\n\nChave: *${key}*\nInformação adicional: *${additional}*`);
}
