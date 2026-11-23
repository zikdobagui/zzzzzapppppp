import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandGift(client: Client, message: wppconnect.Message, command: Command) {
	const [amountStr] = command.args;
	const amount = Number(amountStr);

	if (Number.isNaN(amount)) {
		client.sendText(
			message.from,
			'Você precisa informar o valor do gift.\n\nExemplo: /gift 10'
		);
		return;
	}

	const code = (
		Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
	).toUpperCase();

	await prisma.gifts.create({
		data: {
			code,
			amount: amount,
			bot: {
				connect: {
					wid: client.wid,
				},
			},
		},
	});

	await client.sendText(
		message.from,
		`Gift criado com sucesso.\n\nValor: *R$ ${amount}*\n\nUse: */resgatar ${code}*`
	);
	await client.sendText(message.from, `/resgatar ${code}`);

	notifyAdmin(client, `Admin *${message.author || message.from}* criou um gift\n\nValor: *R$ ${amount}*\nCódigo: *${code}*`);
}
