import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandDefinePix(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const [min, max] = command.args;

	if (!min || !max) {
		client.sendText(message.from, 'Você precisa informar o valor mínimo e máximo.\n\nExemplo: /pixvalor 3 100');
		return;
	}

	await prisma.bot.update({
		where: {
			wid: client.wid!,
		},
		data: {
			pixMin: Number(min),
			pixMax: Number(max),
		},
	});

	await client.sendText(message.from, `O valor mínimo e máximo do PIX foi atualizado com sucesso\n\nValor mínimo: *${min}*\nValor máximo: *${max}*`);
	notifyAdmin(client, `Admin ${message.author || message.from} atualizou o valor mínimo e máximo do PIX\n\nValor mínimo: *${min}*\nValor máximo: *${max}*`);
}
