import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client } from '@/types/client';
import prisma from '@/services/prisma';

export async function initialSettings(client: Client, message: Pick<wppconnect.Message, 'from'> & Partial<Pick<wppconnect.Message, 'author'>>, requirePayment = true) {
	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid,
		},
		include: {
			admins: true,
		},
	});

	if (!bot) return;

	const userId = message.author || message.from;

	function replyUser(text: string) {
		if (!bot) {
			client.sendText(message.from, 'Error interno, contate o criador do bot!');
			return;
		}

		const admins = bot.admins.map((admin) => admin.wid);
		admins.push(bot.owner);

		if (!admins.includes(userId)) {
			client.sendText(message.from, 'Bot não configurado, tente novamente mais tarde...');
			return;
		}

		client.sendText(message.from, text);
	}

	if (bot.expireAt < new Date() && process.env.BOT_PHONE !== client.wid?.replace(/\D/g, '')) {
		replyUser(
			'*Bot expirado*\n\n' +
				`*Data dá expiração:* ${bot.expireAt.toLocaleString('pt-BR')}\n\n` +
				'Use o comando /renovar para renovar o bot'
		);
		return false;
	}

	if (requirePayment && bot.pixType === 'auto' && !bot.mercadoPagoToken) {
		replyUser(
			'Token do Mercado Pago não configurado\n\nUse o comando /tokenmp para configurar'
		);
		return false;
	}

	if (requirePayment && bot.pixType === 'manual' && !bot.pixManualKey) {
		replyUser('Chave pix não configurada\n\nUse o comando /pixmanual para configurar');
		return false;
	}

	return true;
}
