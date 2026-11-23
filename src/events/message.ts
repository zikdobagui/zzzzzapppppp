import { handleTelegram, telegramSensitive } from './telegram';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { PrismaClient } from '@prisma/client';
import { Client } from '@/types/client';
import { handlerCommand } from './commands';
import { menu } from '@/events/menu';
import { initialSettings } from './initialSettings';
import { notifyError } from '@/helpers/notify';

const prisma = new PrismaClient();

export default async function onMessage(client: Client, message: wppconnect.Message) {
	if (message.fromMe) return;
	let sensitive = telegramSensitive(client.wid, message.from, message.body);
	try {
		// O WhatsApp também identifica conversas privadas por LID.
		for (const field of ['from', 'author'] as const) {
			const address = message[field];
			if (!address?.endsWith('@lid')) continue;
			const entry = await client.getPnLidEntry(address);
			if (entry.phoneNumber?._serialized) {
				message[field] = entry.phoneNumber._serialized;
			}
		}
		sensitive ||= telegramSensitive(client.wid, message.from, message.body);
		const isPrivate = message.from.endsWith('@c.us') || message.from.endsWith('@lid');
		console.log(`Mensagem recebida: conversa ${isPrivate ? 'privada' : 'grupo/outro'}`);
		if (isPrivate) {
			await upsertUser(client, message);
		}

		// const isAncientedMessage = verifyAncientMessage(message);
		// if (isAncientedMessage) return;

		const isBlocked = await verifyBotBlocked(client, message);
		if (isBlocked) return;

		if (isPrivate) {
			const isMaintenance = await verifyMaintenance(client, message);
			if (isMaintenance) return;
		}

		if (await handleTelegram(client, message)) return;

		const isCommand = await handlerCommand(client, message);
		if (isCommand) return;

		if (isPrivate) {
			const isConfigured = await initialSettings(client, message, false);
			if (!isConfigured) return;

			await menu(client, message);
		}
	} catch (error) {
		console.error('Falha ao processar mensagem:', sensitive ? 'Falha ao processar vínculo Telegram.' : error);
		await client.sendText(
			message.from,
			'Ocorreu um erro ao processar sua mensagem. Tente novamente ou entre em contato com o suporte.'
		);
		await notifyError(client, sensitive ? { ...message, body: '[código de vínculo omitido]' } : message, 'Message', sensitive ? new Error('Falha ao processar vínculo Telegram.') : error);
	}
}

async function upsertUser(client: Client, message: wppconnect.Message) {
	const widSender = message.author || message.from;

	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid,
		},
	});

	const user = await prisma.user.findFirst({
		where: {
			wid: widSender,
			bot: {
				wid: client.wid,
			},
		},
	});
	if (!user && bot!.bonus > 0) {
		await client.sendText(widSender, `💰 Bonús de novo usuário de R$${bot!.bonus}`);
	}

	if (user) return;

	await prisma.user.create({
		data: {
			wid: widSender,
			balance: bot?.bonus,
			bot: {
				connect: {
					wid: client.wid,
				},
			},
		},
	});
}

async function verifyBotBlocked(client: Client, message: wppconnect.Message) {
	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid!,
		},
		select: {
			block: true,
		},
	});

	const userId = message.author || message.from;

	const owners = process.env.OWNER_PHONE?.split(',')?.map((owner) => `${owner.trim()}@c.us`) || [];
	const isOwner = owners.includes(userId);
	if (isOwner) return false;

	if (bot?.block) {
		client.sendText(message.from, 'Este bot está bloqueado! Contate o suporte.');
		return true;
	}
}

async function verifyMaintenance(client: Client, message: wppconnect.Message) {
	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid!,
		},
		select: {
			maintenance: true,
			owner: true,
			admins: {
				select: {
					wid: true,
				},
			},
		},
	});

	const userId = message.author || message.from;

	const owners = process.env.OWNER_PHONE?.split(',')?.map((owner) => `${owner.trim()}@c.us`) || [];
	const isOwner = owners.includes(userId);
	if (isOwner) return false;

	bot?.admins.push({ wid: bot?.owner });
	const isAdmin = bot?.admins?.some((admin) => admin.wid === userId);
	if (isAdmin) return false;

	if (bot?.maintenance) {
		client.sendText(message.from, 'Bot em manutenção! Tente novamente mais tarde.');
		return true;
	}
}

function verifyAncientMessage(message: wppconnect.Message) {
	const dateMessage = new Date(message.timestamp * 1000);
	const dateNow = new Date();

	const diff = dateNow.getTime() - dateMessage.getTime();
	const diffMinutes = diff / 1000 / 60;

	if (diffMinutes > 1) {
		console.log(`Mensagem antiga recebida e ignorada: ${message.from}`);
		return true;
	}

	return false;
}
