import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import { writeFileSync } from 'fs';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandImageLogin(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const args = command.args.join(' ');

	if (message.type !== 'image') {
		await client.sendText(
			message.from,
			'Use /loginimg [NOME DO LOGIN] na legenda de uma imagem!'
		);
		return;
	}

	if (!args) {
		await client.sendText(
			message.from,
			'Use /loginimg [NOME DO LOGIN] na legenda de uma imagem!'
		);
		return;
	}

	const login = await prisma.loginsSettings.findFirst({
		where: {
			name: args,
			bot: {
				wid: client.wid,
			},
		},
	});
	if (!login) {
		await client.sendText(message.from, 'Login não encontrado!');
		return;
	}

	const response = await client.downloadMedia(message);

	const base64Data = response.replace(/data:image\/.+;base64,/, '');
	const buffer = Buffer.from(base64Data, 'base64');

	await prisma.loginsSettings.update({
		where: {
			id: login.id,
			bot: {
				wid: client.wid,
			},
		},
		data: {
			image: buffer,
		},
	});

	await client.sendText(message.from, `Image do login *${login.name}* atualizada com sucesso!`);
	notifyAdmin(client, `Admin ${message.author || message.from} atualizou a imagem do login *${login.name}*`);
}
