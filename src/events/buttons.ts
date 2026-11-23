import { handleTelegram, TELEGRAM_STORE_OPTION, TELEGRAM_HELP_OPTION } from './telegram';
import { menu } from './menu';
import { initialSettings } from './initialSettings';
import { Client, PollResponse } from '@/types/client';
import { addBalance } from '@/buttons/addBalance';
import { responseBuyLogin, showLogins } from '@/buttons/logins';
import { infoUser } from '@/buttons/infoUser';
import { support } from '@/buttons/support';
import { creator } from '@/buttons/creator';
import { notifyOwner } from '@/helpers/notify';
import { loginsHistory } from '@/buttons/loginsHistory';
import { affiliateds } from '@/buttons/afiliados';
import { inspect } from 'util';

const previouslySelected: Record<string, string[]> = {};

type ButtonFunction = (client: Client, data: PollResponse) => Promise<void>;

const buttons: Record<string, ButtonFunction> = {
	'💸 Adicionar Saldo': addBalance,
	'🛍️ Logins': showLogins,
	'👤 Informações': infoUser,
	'🆘 Suporte': support,
	'👨‍💻 Criador': creator,
	'🧾 Histórico de Logins': loginsHistory,
	'🫂 Afiliados': affiliateds,
};

export default async function onPollResponse(client: Client, data: PollResponse) {
	if (data.msgId.fromMe !== true) return;
	for (const field of ['sender', 'chatId'] as const) {
		if (!data[field].endsWith('@lid')) continue;
		const entry = await client.getPnLidEntry(data[field]);
		if (entry.phoneNumber?._serialized) data[field] = entry.phoneNumber._serialized as PollResponse['sender'];
	}

	const selected = parserPollResponse(data, client.wid || '');
	data.selected = selected;
	const added = selected.added;
	if (added === undefined) return;

	try {
		if (added === TELEGRAM_STORE_OPTION || added === TELEGRAM_HELP_OPTION) {
   if (data.chatId !== data.sender) return;
   await handleTelegram(client, { from: data.sender, body: added === TELEGRAM_STORE_OPTION ? '/loja' : '/ajudavinculo' });
   if (added === TELEGRAM_STORE_OPTION) {
    const message = { from: data.sender };
    if (await initialSettings(client, message, false)) await menu(client, message);
   }
   return;
  }
		if (added === '🧾 Histórico Telegram') {
			if (data.chatId !== data.sender) return;
			await handleTelegram(client, { from: data.sender, body: '/historicotelegram' });
			return;
		}
		if (added === '🔗 Telegram') {
			await handleTelegram(client, { from: data.chatId, body: '/telegram' });
			return;
		}
		const button = buttons[added];
		if (button) {
			await button(client, data);
			return;
		}

		await responseBuyLogin(client, data);
	} catch (error: any) {
		console.log(error);

		await client.sendText(data.chatId, 'Ocorreu um erro ao processar sua mensagem. Tente novamente ou entre em contato com o suporte.');
		
		const text =
			'*ERROR Button*\n\n' +
			`User: wa.me/${data.sender.replace(/\D/g, '')}\n` +
			`Chat: ${data.chatId}\n` +
			`Botão: ${data.selected.added}\n\n\n` +
			`${inspect(error)}`;
		notifyOwner(client, text);
	}
}

function parserPollResponse(data: PollResponse, botWid: string) {
	const key = `${botWid}:${data.sender}:${data.msgId.id}`;
	const prevSelected = previouslySelected[key] || [];
	const newSelected = data.selectedOptions
		.filter((item) => item !== null)
		.map((item) => item!.name);

	const added = newSelected.filter((item) => !prevSelected.includes(item))?.[0];
	const removed = prevSelected.filter((item) => !newSelected.includes(item))?.[0];

	previouslySelected[key] = newSelected;

	return {
		added,
		removed,
	};
}
