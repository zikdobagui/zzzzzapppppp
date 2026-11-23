import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import { LoginsSettings, PrismaClient } from '@prisma/client';
import { notifyAdmin } from '@/helpers/notify';
import { rmSync, writeFileSync } from 'fs';

const prisma = new PrismaClient();

export async function commandDefineNotifySales(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const widNotify = command.args.join(' ');

	if (!widNotify) {
		client.sendText(
			message.from,
			'Você precisa informar o ID do grupo, para pegar o ID do grupo, va no chat do grupo e execute o comando /id.\n\n' +
				'Exemplo: /notificacoes *99999999999@g.us* ou *0* para desativar as notificações.'
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

	if (widNotify === '0') {
		await prisma.bot.update({
			where: {
				wid: client.wid!,
			},
			data: {
				notifySalesWid: '',
			},
		});

		client.sendText(message.from, 'Notificações desativadas.');
		return;
	}

	if (!widNotify.endsWith('@g.us')) {
		client.sendText(message.from, 'O ID do grupo precisa terminar com @g.us');
		return;
	}

	await prisma.bot.update({
		where: {
			wid: client.wid!,
		},
		data: {
			notifySalesWid: widNotify,
		},
	});

	await client.sendText(message.from, `Notificações ativadas para o grupo ${widNotify}.`);
	await notifyAdmin(client, `O Admin ${message.author || message.from} ativou as notificações para o grupo ${widNotify}.`);
}

export async function notifySales(
	client: Client,
	login: LoginsSettings,
	user: string
) {
	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid!,
		},
	});

	if (!bot || !bot.notifySalesWid) return;

	const text =
		'*📱 USUÁRIO COMPROU UM LOGIN 📱*\n\n' +
		`*⚜️ ${login.name} ⚜️*\n` +
		`*👤 Usuario:* @${user.replace(/\D/g, '')}\n` +
		`*💰 Valor:* R$ ${login.price}\n\n` +
		'VENHA ADQUIRIR OS MELHORES LOGINS DO MERCADO!\n\n' +
		'ATENDIMENTO 100% AUTOMÁTICO!\n\n' +
		'Este é o número do BOT, mande qualquer mensagem!\n' +
		`wa.me/${bot.wid.replace(/\D/g, '')}`;

	if (login.image) {
		const filename = `./assets/${Date.now()}.png`;
		writeFileSync(filename, login.image);

		await client.sendImage(bot.notifySalesWid, filename, 'image.png', text);
		
		rmSync(filename);
	} else {
		await client.sendText(bot.notifySalesWid, text, { mentionedList: [user] });
	}
}
