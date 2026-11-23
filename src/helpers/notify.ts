import * as wppconnect from '@wppconnect-team/wppconnect';
import prisma from '@/services/prisma';
import { Client } from '@/types/client';
import { inspect } from 'util';

export async function notifyAdmin(client: Client, text: string) {
	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid,
		},
		include: {
			admins: {
				select: {
					wid: true,
				},
			},
		},
	});

	if (!bot!.admins) return;

	if (!bot?.admins?.find((admin) => admin.wid === bot.owner)) {
		bot?.admins?.push({ wid: bot.owner });
	}

	for (const { wid } of bot!.admins) {
		await client.sendText(wid, text);
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
}

export async function notifyOwner(client: Client, text: string) {
	const owners = process.env.OWNER_PHONE?.split(',')?.map((owner) => `${owner.trim()}@c.us`) || [];
	
	for (const owner of owners) {
		await client.sendText(owner, text);
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
}

export async function notifyError(
	client: Client,
	message: wppconnect.Message,
	name: string,
	error: any
) {
	console.log(error);
	
	const text =
		`ERROR ${name}\n\n` +
		`User: wa.me/${(message.author || message.from).replace(/\D/g, '')}\n` +
		`Chat: ${message.from}\n` +
		`Message: ${message.body}\n\n\n` +
		`${inspect(error)}`;

	return notifyOwner(client, text);
}
