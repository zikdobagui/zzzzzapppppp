import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyAdmin } from '@/helpers/notify';

const menus: Record<string, string> = {
	inicial: 'textMenu',
	pix: 'textPix',
	suporte: 'textSupport',
	login: 'textLogin',
	pixmanual: 'textPixManual',
	afiliados: 'textAffiliateds',
};

export async function commandDefineText(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const [menu, ...textArg] = command.args.join(' ').split(/\n/);
	const text = textArg.join('\n');

	if (!menu || !text) {
		const str =
			'Você precisa informar o nome do menu e o texto.\n\n' +
			`Menus disponíveis:\n\`\`\`${Object.keys(menus).join('\n')}\`\`\`\n\n` +
			'Modo de uso: /text [NOME DO MENU]\n[TEXTO DO MENU]\n\n' +
			'Exemplo: /text inicial\nOlá, seja bem vindo ao nosso bot!';

		client.sendText(message.from, str);
		return;
	}

	const menuName = menu.toLowerCase();
	const menuKey = menus[menuName];
	if (!menuKey) {
		client.sendText(
			message.from,
			`O menu *${menuName}* não está cadastrado. Os menus cadastrados são: ${Object.keys(
				menus
			).join(', ')}`
		);
		return;
	}

	await prisma.bot.update({
		where: {
			wid: client.wid!,
		},
		data: {
			[menuKey]: text,
		},
	});

	await client.sendText(message.from, `O menu *${menuName}* foi atualizado com sucesso.`);
	notifyAdmin(
		client,
		`Admin ${
			message.author || message.from
		} atualizou o texto do menu *${menuName}*\nTexto:\n${text}`
	);
}
