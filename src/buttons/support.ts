import prisma from '@/services/prisma';
import { Client, PollResponse } from '@/types/client';

export async function support(client: Client, data: PollResponse) {
	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid,
		},
	});

	client.sendText(data.chatId, bot!.textSupport);
}