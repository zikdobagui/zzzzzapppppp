import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

export async function commandDefineTextLogin(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const [loginName, ...textArg] = command.args.join(' ').split(/\n/);
	const text = textArg.join('\n');

	if (!loginName || !text) {
		const str =
			'Você precisa informar o nome do login e o texto.\n\n' +
			'Modo de uso: /logintext [NOME DO LOGIN]\n[TEXTO]\n\n' +
			'Exemplo: /logintext Netflix\nBela compra, obrigado!';

		client.sendText(message.from, str);
		return;
	}

	const login = await prisma.loginsSettings.findFirst({
		where: {
			name: loginName,
			bot: {
				wid: client.wid,
			},
		},
	});

	if (!login) {
		client.sendText(message.from, 'Login não encontrado.');
		return;
	}

	await prisma.loginsSettings.update({
		where: {
			id: login.id,
			bot: {
				wid: client.wid,
			},
		},
		data: {
			text,
		},
	});

	await client.sendText(message.from, `O texto do login *${login.name}* foi atualizado com sucesso.`);
	notifyAdmin(
		client,
		`Admin ${
			message.author || message.from
		} atualizou o texto do login *${login.name}*\nTexto:\n${text}`
	);
}
