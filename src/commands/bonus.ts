import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandDefineBonus(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const arg = command.args?.[0]?.replace(/[^\d.]/g, '');
	const amount = Number(arg);

	if (!arg || isNaN(amount) || amount < 0) {
		client.sendText(
			message.from,
			'Você precisa informar o valor do bonús. Para desativar deixe o valor como *0*. Exemplo: */bonus 10*'
		);
		return;
	}

	await prisma.bot.update({
		where: {
			wid: client.wid!,
		},
		data: {
			bonus: amount,
		},
	});

	await client.sendText(message.from, `O valor do bonús foi atualizado para *${amount}*.`);
	notifyAdmin(
		client,
		`Admin ${message.author || message.from} atualizou o valor do bonús para *${amount}*.`
	);
}
