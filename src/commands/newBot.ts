import * as wppconnect from '@wppconnect-team/wppconnect';
import { PrismaClient } from '@prisma/client';
import { createBot } from '@/connection';
import qr from 'qr-image';
import { Client, Command } from '@/types/client';
import { notifyAdmin } from '@/helpers/notify';
import { handler } from '@/index';

const prisma = new PrismaClient();

export async function commandNewBot(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const [phoneBot, phoneOwner, ...rest] = command.args;

	const nameBot = rest.join(' ');

	if (!phoneBot || !phoneOwner || !nameBot) {
		client.sendText(
			message.from,
			'Forma de uso: /newbot [NUMERO DO BOT] [NUMERO DO DONO] [NOME DO BOT]\n\nExemplo: /newbot 5511999999999 5511999999999 bot-chocolate'
		);
		return;
	}

	const bot = await prisma.bot.upsert({
		where: {
			wid: `${phoneBot}@c.us`,
		},
		create: {
			wid: `${phoneBot}@c.us`,
			name: nameBot,
			owner: `${phoneOwner}@c.us`,
		},
		update: {
			owner: `${phoneOwner}@c.us`,
		},
	});

	await client.sendText(message.from, `Bot *${bot.name}* criado com sucesso, iniciando...`);
	notifyAdmin(client, `O bot *${bot.name}* foi criado e iniciado pelo admin *${message.author || message.from}*.`);

	let qrcodeSended = false;
	
	const clientBotCreated = await createBot(bot, {
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
			if (status === 'notLogged' || status === 'disconnectedMobile') return;

			if (status === 'qrReadError' || status === 'qrReadFail') {
				client.sendText(message.from, 'Erro ao ler o QR Code, tente cria-lo novamente!', { quotedMsg: message.id });
				return;
			}

			if (status === 'qrReadSuccess') {
				client.sendText(message.from, 'QR Code lido com sucesso, iniciando a sessão!', { quotedMsg: message.id });
				return;
			}

			// client.sendText(message.from, `Status da conexão: ${status}`, { quotedMsg: message.id });
		},
	});

	handler(clientBotCreated);
}
