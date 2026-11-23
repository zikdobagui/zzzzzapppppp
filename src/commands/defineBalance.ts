import { loadTelegramSummary } from '../services/accountSummary';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandDefineBalance(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const [_number, _amount] = command.args.join(' ').split('|');
	const number = _number?.replace(/\D/g, '');
	const amount = Number(_amount?.replace(/[^\d.]/g, '') || NaN);

	if (!number || Number.isNaN(amount)) {
		client.sendText(
			message.from,
			'Número ou valor invalido ou não informado. Use: */definirsaldo 5511999999999|100*'
		);
		return;
	}

 const account = await loadTelegramSummary(client.wid, `${number}@c.us`);
 if (account.state !== 'unlinked') {
  await client.sendText(message.from, account.state === 'linked'
   ? 'Cliente vinculado: altere o saldo no painel/Telegram. A alteração aparecerá automaticamente no WhatsApp.'
   : 'Consulta de saldo compartilhado indisponível. Nenhum saldo foi alterado.');
  return;
 }
	const user = await prisma.user.findFirst({
		where: {
			wid: `${number}@c.us`,
			bot: {
				wid: client.wid!,
			},
		},
	});

	if (!user) {
		client.sendText(message.from, 'Usuário não encontrado.');
		return;
	}

	await prisma.user.update({
		where: {
			id: user.id,
		},
		data: {
			balance: amount,
		},
	});

	await client.sendText(
		message.from,
		`O saldo do usuário ${number} foi definido para R$ ${amount.toFixed(2)}`
	);
	notifyAdmin(client, `O saldo do usuário ${number} foi definido para R$ ${amount.toFixed(2)}`);
}
