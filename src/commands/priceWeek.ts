import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandPriceWeek(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const _amount = command.args.join(' ');
	const amount = Number(_amount);

	if (client.wid?.replace(/\D/g, '') !== process.env.BOT_PHONE) {
		client.sendText(message.from, 'Bot não é o principal.');
		return;
	}

	if (!amount) {
		client.sendText(
			message.from,
			'Você precisa informar o valor do aluguel semanal dos bots.\n\nExemplo: /precosemana 10'
		);
		return;
	}

	await prisma.botMaster.update({
		where: {
			wid: client.wid!,
		},
		data: {
			priceWeek: amount,
		},
	});

	await client.sendText(
		message.from,
		`Valor do aluguel semanal atualizado com sucesso\n\nValor: *${amount}*`
	);
	notifyAdmin(
		client,
		`Admin ${
			message.author || message.from
		} atualizou o valor do aluguel semanal dos bots\n\nValor: *${amount}*`
	);
}
