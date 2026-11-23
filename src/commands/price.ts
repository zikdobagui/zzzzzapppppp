import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import { PrismaClient } from '@prisma/client';
import { notifyAdmin } from '@/helpers/notify';

const prisma = new PrismaClient();

export async function commandDefinePrice(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const [name, price] = command.args.join(' ').split(/\|/).map((value) => value.trim());

	if (!name || !price) {
		client.sendText(
			message.from,
			'Você precisa informar o nome e o preço do produto. Exemplo: /price Netflix|10'
		);
		return;
	}

	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid!,
		},
	});

	if (bot === null) {
		client.sendText(message.from, 'O bot não está configurado.');
		return;
	}

	const product = await prisma.loginsSettings.findUnique({
		where: {
			name,
		},
	});

	if (product === null || product.botId !== bot.id) {
		client.sendText(message.from, 'O produto não está cadastrado.');
		return;
	}

	const priceNumber = Number(price.replace(',', '.'));

	if (!Number.isFinite(priceNumber) || priceNumber <= 0 || Math.abs(priceNumber * 100 - Math.round(priceNumber * 100)) > 0.000001) {
		client.sendText(message.from, 'O preço precisa ser maior que zero e ter no máximo duas casas decimais.');
		return;
	}

	await prisma.loginsSettings.update({
		where: {
			name,
		},
		data: {
			price: priceNumber,
		},
	});

	await client.sendText(
		message.from,
		`O preço do produto ${name} foi alterado para R$ ${priceNumber.toFixed(2)}.`
	);
	notifyAdmin(client, `Admin *${message.author || message.from}* alterou o preço do produto *${name}* para *R$ ${priceNumber.toFixed(2)}*.`);
}
