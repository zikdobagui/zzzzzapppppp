import * as wppconnect from '@wppconnect-team/wppconnect';
import { PrismaClient } from '@prisma/client';
import { createBot } from '@/connection';
import qr from 'qr-image';
import { Client, Command } from '@/types/client';
import { clients, handler } from '@/index';
import { notifyAdmin } from '@/helpers/notify';
import { rmdirSync } from 'fs';

const prisma = new PrismaClient();

export async function commandReconnectBot(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const [phoneBot] = command.args;

	if (!phoneBot) {
		client.sendText(
			message.from,
			'Forma de uso: /reconnect [NUMERO DO BOT]\n\nExemplo: /reconnect 5511999999999'
		);
		return;
	}

	const bot = await prisma.bot.findUnique({
		where: {
			wid: `${phoneBot}@c.us`,
		},
	});

	if (!bot) {
		client.sendText(message.from, `Bot *${phoneBot}* não encontrado!`);
		return;
	}

	if (!clients[bot.wid]) {
		await client.sendText(
			message.from,
			'Instância do bot não encontrada. Criando uma nova...',
			{
				quotedMsg: message.id,
			}
		);

		let qrcodeSended = false;

		clients[bot.wid] = await createBot(bot, {
			catchQR: async (base64Qrimg, asciiQR, attempt, urlCode) => {
				if (qrcodeSended) return;

				const png = qr.imageSync(urlCode!, { type: 'png' });
				let base64 = Buffer.from(png).toString('base64');

				base64 = `data:image/png;base64,${base64}`;

				await client.sendImageFromBase64(
					message.from,
					base64,
					'qr_code',
					'Leia o QR Code para iniciar a sessão!'
				);

				qrcodeSended = true;
			},
			statusFind: (status) => {
				if (status === 'qrReadError' || status === 'qrReadFail') {
					client.sendText(message.from, 'Erro ao ler o QR Code, tente novamente!');
				}
			},
		});

		handler(clients[bot.wid]);

		notifyAdmin(
			client,
			`Admin ${message.author || message.from} está reconectando o bot *${phoneBot}*`
		);
		return;
	}

	await client.sendText(message.from, 'Reconectando bot, aguarde...', {
		quotedMsg: message.id,
	});

	await clients[bot.wid].logout();
	rmdirSync(`./tokens/${bot.name}`, { recursive: true });
	
	clients[bot.wid] = await createBot(bot, {
		catchQR: async (base64Qrimg, asciiQR, attempt, urlCode) => {
			const png = qr.imageSync(urlCode!, { type: 'png' });
			let base64 = Buffer.from(png).toString('base64');

			base64 = `data:image/png;base64,${base64}`;

			await client.sendImageFromBase64(
				message.from,
				base64,
				'qr_code',
				'Leia o QR Code para iniciar a sessão!'
			);
		},
		statusFind: (status) => {
			if (status === 'qrReadError' || status === 'qrReadFail') {
				client.sendText(message.from, 'Erro ao ler o QR Code, tente novamente!');
			}
		},
	});
	handler(clients[bot.wid]);

	notifyAdmin(
		client,
		`Admin ${message.author || message.from} está reconectando o bot *${phoneBot}*`
	);
}
