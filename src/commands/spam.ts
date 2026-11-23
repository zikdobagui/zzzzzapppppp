import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';
import { rmSync, writeFileSync } from 'fs';

export async function commandSpam(client: Client, message: wppconnect.Message, command: Command) {
	const text = command.args.join(' ');

	if (!text) {
		client.sendText(
			message.from,
			'Você precisa informar o texto que deseja enviar. Use: /spam texto'
		);
		return;
	}

	const users = await prisma.user.findMany({
		where: {
			bot: {
				wid: client.wid!,
			},
		},
		select: {
			wid: true,
		},
	});

	if (users.length === 0) {
		client.sendText(message.from, 'Nenhum usuário encontrado.');
		return;
	}

	await client.sendText(message.from, `Enviando mensagem para ${users.length} usuários...`);
	notifyAdmin(
		client,
		`Admin ${message.author || message.from} está fazendo spam para ${users.length} usuários...`
	);

	let filename: string | undefined;
	if (message.type === 'image') {
		const response = await client.downloadMedia(message);

		const base64Data = response.replace(/data:image\/.+;base64,/, '');
		const buffer = Buffer.from(base64Data, 'base64');
		filename = `./assets/${Date.now()}.jpg`;

		writeFileSync(filename, buffer);
	}

	let count = 0;
	for (const user of users) {
		try {
			if (filename) {
				await client.sendImage(user.wid, filename, 'image.jpg', text);
			} else {
				await client.sendText(user.wid, text);
			}
			count++;
		} catch (error) {
			console.error(error);
		}
		await new Promise((resolve) => setTimeout(resolve, 10000));
	}

	if (filename) rmSync(filename);

	client.sendText(message.from, `Mensagem enviada para ${count} usuários com sucesso.`);
}
