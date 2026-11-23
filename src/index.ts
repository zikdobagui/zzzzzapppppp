import 'dotenv/config';
import { acquireRuntimeLock } from './helpers/runtimeLock';
import { PrismaClient } from '@prisma/client';
import { createBot } from '@/connection';
import { Client, PollResponse } from '@/types/client';
import onPollResponse from '@/events/buttons';
import onMessage from '@/events/message';
import { fakeNotify } from './events/fakeNotify';
import { saveBotPhone } from './helpers/sessionPhone';

const prisma = new PrismaClient();
export const clients: Record<string, Client> = {};

let releaseLock: (() => void) | undefined;
let shuttingDown = false;
async function shutdown(exitCode = 0) {
 if (shuttingDown) return;
 shuttingDown = true;
 await Promise.allSettled(Object.values(clients).map(client => client.close()));
 await prisma.$disconnect();
 releaseLock?.();
 process.exit(exitCode);
}
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
process.once('exit', () => releaseLock?.());
async function start() {
 releaseLock = acquireRuntimeLock();
 await main();
}
start().catch(async (error) => {
 console.error('Falha ao iniciar o bot:', error instanceof Error ? error.message : error);
 await shutdown(1);
});
async function main() {
	const owners = process.env.OWNER_PHONE?.split(',')?.map((owner) => `${owner.trim()}@c.us`) || [];

	// Abre a sessão antes de consultar a identidade: BOT_PHONE pode estar desatualizado.
	const previousBot = await prisma.bot.findFirst({
		where: { name: 'Principal' }, orderBy: { id: 'asc' },
	});
	const mainClient = await createBot(previousBot);
	clients.__starting = mainClient;
	const connectedWid = (await mainClient.getWid())?.replace(/:\d+(?=@)/, '').replace(/@s\.whatsapp\.net$/, '@c.us');
	if (!connectedWid || !/^[1-9]\d{9,14}@c\.us$/.test(connectedWid)) {
		await mainClient.close();
		throw new Error('Não foi possível identificar o número da sessão conectada.');
	}
	let mainBot;
	try {
		mainBot = await prisma.$transaction(async (tx) => {
			const existing = await tx.bot.findUnique({ where: { wid: connectedWid } });
			if (existing && previousBot && existing.id !== previousBot.id) {
				throw new Error('O número conectado já pertence a outro cadastro. Os cadastros foram preservados.');
			}
			const owner = owners[0] || previousBot?.owner || connectedWid;
			const bot = previousBot
				? await tx.bot.update({ where: { id: previousBot.id }, data: { wid: connectedWid, owner } })
				: await tx.bot.upsert({ where: { wid: connectedWid }, create: { wid: connectedWid, name: 'Principal', owner }, update: { name: 'Principal', owner } });
			if (previousBot && previousBot.wid !== connectedWid) {
				await tx.botMaster.updateMany({ where: { botId: bot.id, wid: previousBot.wid }, data: { wid: connectedWid } });
			}
			await tx.botMaster.upsert({ where: { wid: connectedWid }, create: { wid: connectedWid, botId: bot.id }, update: { botId: bot.id } });
			return bot;
		});
	} catch (error) {
		await mainClient.close();
		throw error;
	}
	mainClient.db = mainBot;
	const phone = connectedWid.split('@')[0];
	process.env.BOT_PHONE = phone;
	try {
		await saveBotPhone(phone);
	} catch (error) {
		console.warn('Bot conectado, mas não foi possível salvar BOT_PHONE no .env:', error);
	}
	await handler(mainClient);
	delete clients.__starting;
	const bots = process.env.START_ALL_BOTS === 'true'
		? await prisma.bot.findMany({ where: { id: { not: mainBot.id } }, orderBy: { id: 'asc' } })
		: [];
	const orderedBots = bots;
	const sessions = new Set<string>([mainBot.name.toLowerCase()]);
	const uniqueBots = orderedBots.filter((bot) => {
		const session = bot.name.toLowerCase();
		if (sessions.has(session)) {
			console.warn(`Bot ID ${bot.id} ignorado: a sessão "${bot.name}" já está em uso por outro cadastro.`);
			return false;
		}
		sessions.add(session);
		return true;
	});

	for (const bot of uniqueBots) {
		try {
			const client = await createBot(bot);
			await handler(client);
		} catch (error) {
			console.error(`Falha ao conectar o bot "${bot.name}" (ID ${bot.id}):`, error);
		}
	}
}

export async function handler(client: Client) {
	const expectedBot = client.db;
	const connectedWid = await client.getWid();
	client.wid = connectedWid?.replace(/:\d+(?=@)/, '').replace(/@s\.whatsapp\.net$/, '@c.us');
	if (!client.wid) {
		throw new Error('Wid not found');
	}
	if (expectedBot && client.wid !== expectedBot.wid) {
		await client.close();
		throw new Error(`A sessão "${expectedBot.name}" conectou a conta ${client.wid}, mas o cadastro espera ${expectedBot.wid}. Use o WhatsApp do número cadastrado; confira BOT_PHONE no .env para o Principal.`);
	}

	client.db = await prisma.bot.findUnique({
		where: {
			wid: client.wid,
		},
	});
	if (!client.db) {
		throw new Error(`O número conectado (${client.wid}) não está cadastrado como bot.`);
	}

	clients[client.wid] = client;

	client.onMessage((message) => onMessage(client, message));
	client.onPollResponse((poll) => onPollResponse(client, poll as unknown as PollResponse));
	console.log(`Bot "${client.db.name}" pronto para receber mensagens.`);
	fakeNotify(client);
	
	return client;
}
