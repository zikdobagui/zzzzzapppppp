import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';

export async function commandAffiliated(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const phone = command.args.join(' ').replace(/\D/g, '');

	if (!phone) {
		client.sendText(
			message.from,
			'Você precisa informar um número de telefone do seu afiliado. Exemplo: /afiliado 5511999999999'
		);
		return;
	}

	const affiliator = await prisma.user.findFirst({
		where: {
			wid: `${phone}@c.us`,
			bot: {
				wid: client.wid,
			},
		},
	});

	if (affiliator === null) {
		client.sendText(message.from, 'Este usuário não está cadastrado no sistema.');
		return;
	}

	const widSender = message.author || message.from;

	if (widSender === affiliator.wid) {
		client.sendText(message.from, 'Você não pode se afiliar a si mesmo.');
		return;
	}

	const userSender = await prisma.user.findFirst({
		where: {
			wid: widSender,
			bot: {
				wid: client.wid,
			},
		},
	});

	if (userSender === null) {
		client.sendText(message.from, 'Você não está cadastrado no sistema.');
		return;
	}

	if (userSender.affiliated !== '') {
		client.sendText(message.from, 'Você já está afiliado a um usuário.');
		return;
	}

	await prisma.user.update({
		where: {
			id: affiliator.id,
		},
		data: {
			affiliateds: {
				create: {
					wid: userSender.wid,
					bot: {
						connect: {
							wid: client.wid,
						},
					},
				},
			},
		},
	});

	await prisma.user.update({
		where: {
			id: userSender.id,
		},
		data: {
			affiliated: affiliator.wid,
		},
	});

	await client.sendText(
		message.from,
		`Você foi afiliado com sucesso ao usuário @${affiliator.wid.replace(/\D/g, '')}`,
		{
			mentionedList: [affiliator.wid],
		}
	);

	client.sendText(
		affiliator.wid,
		`O usuário @${userSender.wid.replace(/\D/g, '')} foi afiliado a você.`,
		{
			mentionedList: [userSender.wid],
		}
	);
}
