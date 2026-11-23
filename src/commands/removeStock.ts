import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import { PrismaClient } from '@prisma/client';
import { notifyAdmin } from '@/helpers/notify';

const prisma = new PrismaClient();

export async function commandRemoveStock(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const [name] = command.args;

	if (!name) {
		client.sendText(
			message.from,
			'Você precisa informar o nome do produto que deseja remover. Exemplo: /removerstock Netflix',
			{
				quotedMsg: message.id,
			}
		);
		return;
	}

	const { count } = await prisma.logins.deleteMany({
		where: {
			bot: {
				wid: client.wid!,
			},
			name,
		},
	});

	if (count === 0) {
		client.sendText(message.from, 'O produto não está cadastrado.', {
			quotedMsg: message.id,
		});
		return;
	}

	await client.sendText(message.from, `Foram removidos ${count} logins do produto "${name}".`, {
		quotedMsg: message.id,
	});

	notifyAdmin(client, `Admin ${message.author || message.from} removeu ${count} logins do produto "${name}".`);
}
