import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandAddUsers(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const numbers = command.args
		.join(' ')
		.split(/\r?\n/)
		.map((number) => number.replace(/\D/g, ''))
		.filter(Boolean);

	if (numbers.length === 0) {
		await client.sendText(
			message.from,
			'Você precisa informar os números. Exemplo: /addusers 5511999999999\n5511888888888\n5511777777777'
		);
		return;
	}

	let count = 0;

	for (const number of numbers) {
		try {
			await prisma.user.create({
				data: {
					wid: number,
					bot: {
						connect: {
							wid: client.wid!,
						},
					},
				},
			});

			count++;
		} catch (error: any) {
			console.log(error.message);
		}
	}

	await client.sendText(
		message.from,
		`Foram adicionados ${count} usuários com sucesso, e ${numbers.length - count} falharam.`
	);

	notifyAdmin(
		client,
		`O admin ${message.author || message.from} adicionou ${count} usuários com sucesso, e ${
			numbers.length - count
		} falharam.`
	);
}
