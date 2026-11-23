import { Client } from '@/types/client';
import prisma from '@/services/prisma';
import { notifySales } from '@/commands/notifySales';
import { generatePhone, random, sleep } from '@/helpers/util';

export async function fakeNotify(client: Client) {
	setInterval(async () => {
		await sleep(random(1000 * 60, 1000 * 60 * 5));

		const bot = await prisma.bot.findUnique({
			where: {
				wid: client.wid!,
			},
			select: {
				fakeNotify: true,
				loginsSettings: true,
				logins: true,
			},
		});

		if (!bot) {
			throw new Error('Bot not found');
		}
		if (!bot.fakeNotify) return;

		const logins = bot.loginsSettings.filter((login) =>
			bot.logins.filter(({ name }) => name === login.name)
		);

		if (logins.length === 0) return;

		const login = logins[random(0, logins.length - 1)];
		notifySales(client, login, generatePhone());
	}, 1000 * 60 * 5);
}
