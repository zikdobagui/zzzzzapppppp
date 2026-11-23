import { loadTelegramSummary } from '../services/accountSummary';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandRedeem(client: Client, message: wppconnect.Message, command: Command) {
 const account = await loadTelegramSummary(client.wid, message.from);
 if (account.state !== 'unlinked') {
  await client.sendText(message.from, account.state === 'linked'
   ? 'Sua conta usa o saldo único do Telegram. Resgate o gift no Telegram/site para que o crédito apareça também aqui.'
   : 'Não foi possível consultar o saldo compartilhado. Tente novamente mais tarde.');
  return;
 }
	const [code] = command.args;

	if (!code) {
		client.sendText(
			message.from,
			'Você precisa informar o código do gift.\n\nExemplo: /resgatar ABC123'
		);
		return;
	}

	const gift = await prisma.gifts.findUnique({
		where: {
			code,
			bot: {
				wid: client.wid,
			},
		},
	});

	if (gift === null) {
		client.sendText(message.from, 'Este gift não existe.');
		return;
	}

	if (gift.redeemed) {
		client.sendText(message.from, 'Este gift já foi resgatado.');
		return;
	}

	let user = await prisma.user.findFirst({
		where: {
			wid: message.author || message.from,
			bot: {
				wid: client.wid,
			},
		},
	});

	if (user === null) {
		client.sendText(message.from, 'Você não está cadastrado no sistema.');
		return;
	}

	user = await prisma.user.update({
		where: {
			id: user.id,
		},
		data: {
			balance: {
				increment: gift.amount,
			},
		},
	});

	await prisma.gifts.update({
		where: {
			id: gift.id,
		},
		data: {
			redeemed: true,
			redeemedAt: new Date(),
		},
	});

	await client.sendImage(
		message.from,
		'./assets/gift.jpeg',
		'gift.jpeg',
		`Gift resgatado com sucesso.\n\nValor: *R$ ${gift.amount}*\nSaldo atual: *R$ ${user.balance}*`
	);
	notifyAdmin(
		client,
		`Usuário ${message.author || message.from} resgatou um gift.\n\nValor: *R$ ${
			gift.amount
		}*\nSaldo atual: *R$ ${user.balance}*`
	);
}
