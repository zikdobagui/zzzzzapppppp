import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client } from '@/types/client';
import prisma from '@/services/prisma';

export async function commandAdmin(client: Client, message: wppconnect.Message) {
	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid!,
		},
		include: {
			admins: {
				select: {
					wid: true,
				},
			},
			_count: {
				select: {
					users: true,
					loginsHistory: true,
					logins: true,
				},
			},
			pixHistory: true,
			gifts: {
				where: {
					redeemed: true,
				},
			},
		},
	});
	if (!bot) return;

	const textOwner =
		'*/newbot* - Cria um novo bot\n' +
		'*/reconnect* - Reconecta um bot\n' +
		'*/block* - Bloqueia e desbloqueia um bot\n' +
		'*/tokenmpmaster* - Define o token do Mercado Pago Master\n' +
		'*/precosemanal* - Define o preço semanal\n' +
		'*/removerbot* - Remove um bot\n' +
		'*/bots* - Listar todos os bots\n\n';

	const owners =
		process.env.OWNER_PHONE?.split(',')?.map((owner) => `${owner.trim()}@c.us`) || [];
	const isOwner = owners.includes(message.author || message.from);

	const listAdmins = bot.admins.map(({ wid }) => wid.replace(/\D/g, '')).join(', ');

	const pixToday = bot.pixHistory
		.filter((pix) => {
			const date = new Date();
			date.setHours(0, 0, 0, 0);
			return pix.createAt >= date;
		})
		.reduce((acc, { amount }) => acc + amount, 0);

	const pixWeek = bot.pixHistory
		.filter((pix) => {
			const date = new Date();
			date.setDate(date.getDate() - 7);
			date.setHours(0, 0, 0, 0);
			return pix.createAt >= date;
		})
		.reduce((acc, { amount }) => acc + amount, 0);

	const pixMonth = bot.pixHistory
		.filter((pix) => {
			const date = new Date();
			date.setDate(1);
			date.setHours(0, 0, 0, 0);
			return pix.createAt >= date;
		})
		.reduce((acc, { amount }) => acc + amount, 0);

	const pixTotal = bot.pixHistory.reduce((acc, { amount }) => acc + amount, 0);
	const largerPix = bot.pixHistory.reduce((acc, { amount }) => Math.max(acc, amount), 0);

	const giftTotal = bot.gifts.reduce((acc, { amount }) => acc + amount, 0);
	const largerGift = bot.gifts.reduce((acc, { amount }) => Math.max(acc, amount), 0);

	const text =
		'*Painel Admin*\n\n' +
		`*Dono:* ${bot.owner.replace(/\D/g, '')}\n` +
		`*Lista de Admins:* ${listAdmins}\n\n` +
		`*Data de expiração:* ${bot.expireAt.toLocaleString('pt-BR')}\n\n` +
		'*PIX:*\n' +
		`*Tipo do PIX:* ${bot.pixType}\n` +
		`*Token Mercado Pago:* ${bot.mercadoPagoToken || 'SEM TOKEN'}\n` +
		`*Chave Pix Manual:* ${bot.pixManualKey}\n` +
		`*Informações Adicional Pix Manual:* ${bot.pixManualAdditional}\n` +
		`*PIX de Hoje:* R$ ${pixToday.toFixed(2)}\n` +
		`*PIX da Semana:* R$ ${pixWeek.toFixed(2)}\n` +
		`*PIX do Mês:* R$ ${pixMonth.toFixed(2)}\n` +
		`*PIX Total:* R$ ${pixTotal.toFixed(2)}\n` +
		`*Maior PIX Inserido:* R$ ${largerPix.toFixed(2)}\n\n` +
		`*Usuários Registrados:* ${bot._count.users}\n\n` +
		`*Logins no estoque:* ${bot._count.logins}\n` +
		`*Logins vendidos:* ${bot._count.loginsHistory}\n\n` +
		`*Gifts Resgatados:* R$ ${giftTotal.toFixed(2)}\n` +
		`*Maior Gift Resgatado:* R$ ${largerGift.toFixed(2)}\n\n` +
		'*Comandos Administrativos:*\n' +
		'( _Para saber mais sobre um comando, apenas execute o mesmo._ )\n\n' +
		`${isOwner ? textOwner : ''}` +
		'*/add* - Adiciona estoque de logins\n' +
		'*/text* - Define o texto de um menu\n' +
		'*/pixvalor* - Define o valor mínimo e máximo do PIX\n' +
		'*/notificacao* - Ativa ou desativa as notificações\n' +
		'*/gift* - Cria um gift\n' +
		'*/addadmin* - Adiciona um administrador\n' +
		'*/removeradmin* - Remove um administrador\n' +
		'*/id* - Mostra o ID do chat\n' +
		'*/preco* - Define o preço de um login\n' +
		'*/tokenmp* - Define o token do Mercado Pago\n' +
		'*/pixtipo* - Define o tipo de PIX(manual ou automatico)\n' +
		'*/pixmanual* - Define a chave do PIX manual\n' +
		'*/spam* - Envia uma mensagem para todos os usuários\n' +
		'*/removerstock* - Remove um estoque de logins\n' +
		'*/definirsaldo* - Define o saldo de um usuário\n' +
		'*/renovar* - Renovar aluguel do bot\n' +
		'*/adduser* - Adiciona usuários para fazer spam\n' +
		'*/saldodobro* - Define o saldo em dobro a cada pix\n' +
		'*/bonus* - Define o valor do bônus usuario novato\n' +
		'*/manutencao* - Ativa ou desativa a manutenção\n' +
		'*/notificacoesfake* - Ativa ou desativa as notificações de vendas fake\n' +
		'*/loginimg* - Define a imagem de um login\n' +
		'*/logintext* - Define o texto de um login';

	client.sendText(message.from, text);
}
