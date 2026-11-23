import { loadTelegramSummary, accountSummaryText } from '../services/accountSummary';
import { telegramEnabled } from '../services/telegramApi';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client } from '@/types/client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function menu(client: Client, message: Pick<wppconnect.Message, 'from'> & Partial<Pick<wppconnect.Message, 'author' | 'sender' | 'notifyName'>>) {
	const botConfig = await prisma.bot.findUnique({
		where: {
			wid: client.wid,
		},
	});

	const user = await prisma.user.findFirst({
		where: {
			wid: message.author || message.from,
			bot: {
				wid: client.wid,
			},
		},
		include: {
			_count: { select: { loginsHistory: true } },
		},
	});

	if (!botConfig) {
		await client.sendText(message.from, 'Bot não configurado');
		return;
	}

	if (!user) {
		await client.sendText(message.from, 'Você não está cadastrado no sistema.');
		return;
	}

	const name = (message.sender?.pushname || message.notifyName || message.sender?.name || 'cliente')
		.replace(/[\r\n]+/g, ' ').trim().slice(0, 80) || 'cliente';
	const phone = user.wid.endsWith('@c.us') || user.wid.endsWith('@s.whatsapp.net')
		? `+${user.wid.split('@')[0].split(':')[0]}`
		: 'Não disponível';
	const telegram = await loadTelegramSummary(client.wid, message.from);
	const summary = accountSummaryText({ balance: user.balance, purchases: user._count.loginsHistory }, telegram);
	const text =
		`*Olá, ${name}! Seja bem-vindo(a)!*\n\n` +
		'*◆ ━━━━❪✪❫━━━━ ◆*\n' +
		`*◆ Seu número:* ${phone}\n` +
		summary +
		'*◆ ━━━━❪✪❫━━━━ ◆*\n\n' +
		`${botConfig?.textMenu}`;

	const buttons = [
		'💸 Adicionar Saldo',
		'🛍️ Logins',
		'👤 Informações',
		'🆘 Suporte',
		'👨‍💻 Criador',
	];

	if (telegramEnabled(client.wid)) buttons.push('🔗 Telegram');
	if (telegram.state === 'linked') buttons.push('🧾 Histórico Telegram');

	await client.sendPollMessage(message.from, text, buttons, {
		selectableCount: 1,
	});

	console.log(`Menu enviado para ${message.from}`);
}
