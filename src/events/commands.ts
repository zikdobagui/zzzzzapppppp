import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command, CommandsList } from '@/types/client';
import prisma from '@/services/prisma';
import { notifyError } from '@/helpers/notify';
import { commandNewBot } from '@/commands/newBot';
import { commandReconnectBot } from '@/commands/reconnectBot';
import { commandAddStock } from '@/commands/addStock';
import { commandAffiliated } from '@/commands/affiliated';
import { commandPix } from '@/commands/pix';
import { commandDefinePrice } from '@/commands/price';
import { commandDefineNotifySales } from '@/commands/notifySales';
import { commandDefineText } from '@/commands/text';
import { commandDefinePix } from '@/commands/pixMinMax';
import { commandID } from '@/commands/id';
import { commandGift } from '@/commands/gift';
import { commandRedeem } from '@/commands/redeem';
import { commandAdmin } from '@/commands/adm';
import { commandAddAdmin } from '@/commands/addAdmin';
import { commandRemoveAdmin } from '@/commands/removeAdmin';
import { commandTokenMP } from '@/commands/tokenMP';
import { commandPixType } from '@/commands/pixType';
import { commandPixManual } from '@/commands/pixManual';
import { commandSpam } from '@/commands/spam';
import { commandRemoveStock } from '@/commands/removeStock';
import { commandDefineBalance } from '@/commands/defineBalance';
import { commandMenu } from '@/commands/menu';
import { commandRenew } from '@/commands/renew';
import { commandTokenMPMaster } from '@/commands/tokenMpOwner';
import { commandPriceWeek } from '@/commands/priceWeek';
import { commandBlockBot } from '@/commands/blockBot';
import { commandShowBots } from '@/commands/bots';
import { commandAddUsers } from '@/commands/addusers';
import { commandDoubleBalance } from '@/commands/doubleBalance';
import { commandDefineBonus } from '@/commands/bonus';
import { commandFakeNotify } from '@/commands/fakeNotify';
import { commandMaintenance } from '@/commands/maintenance';
import { commandRemoveBot } from '@/commands/removeBot';
import { commandImageLogin } from '@/commands/imageLogin';
import { commandDefineTextLogin } from '@/commands/textLogin';
import { commandApiProducts, commandApiOrder, commandApiOrders, commandApiRefund } from '@/commands/stockApi';

const commands: CommandsList[] = [
	{ alias: ['apiprodutos'], handler: commandApiProducts, permissions: ['ADM'] },
	{ alias: ['apipedido'], handler: commandApiOrder },
	{ alias: ['apipedidos'], handler: commandApiOrders, permissions: ['ADM'] },
	{ alias: ['apiestornar'], handler: commandApiRefund, permissions: ['ADM'] },
	{
		alias: ['afiliado'],
		handler: commandAffiliated,
	},
	{
		alias: ['pix'],
		handler: commandPix,
	},
	{
		alias: ['resgatar'],
		handler: commandRedeem,
	},
	{
		alias: ['newbot'],
		handler: commandNewBot,
		permissions: ['OWNER'],
	},
	{
		alias: ['reconnect'],
		handler: commandReconnectBot,
		permissions: ['OWNER'],
	},
	{
		alias: ['add', 'addestoque', 'addstock'],
		handler: commandAddStock,
		permissions: ['ADM'],
	},
	{
		alias: ['price', 'preco', 'preço'],
		handler: commandDefinePrice,
		permissions: ['ADM'],
	},
	{
		alias: ['notificacoes', 'notificacao', 'notificações', 'notificação'],
		handler: commandDefineNotifySales,
		permissions: ['ADM'],
	},
	{
		alias: ['text'],
		handler: commandDefineText,
		permissions: ['ADM'],
	},
	{
		alias: ['pixvalor'],
		handler: commandDefinePix,
		permissions: ['ADM'],
	},
	{
		alias: ['id'],
		handler: commandID,
		permissions: ['ADM'],
	},
	{
		alias: ['gift'],
		handler: commandGift,
		permissions: ['ADM'],
	},
	{
		alias: ['adm', 'admin'],
		handler: commandAdmin,
		permissions: ['ADM'],
	},
	{
		alias: ['addadmin'],
		handler: commandAddAdmin,
		permissions: ['ADM'],
	},
	{
		alias: ['removeradmin'],
		handler: commandRemoveAdmin,
		permissions: ['ADM'],
	},
	{
		alias: ['tokenmp'],
		handler: commandTokenMP,
		permissions: ['ADM'],
	},
	{
		alias: ['pixtipo'],
		handler: commandPixType,
		permissions: ['ADM'],
	},
	{
		alias: ['pixmanual'],
		handler: commandPixManual,
		permissions: ['ADM'],
	},
	{
		alias: ['spam'],
		handler: commandSpam,
		permissions: ['ADM'],
	},
	{
		alias: ['removerstock'],
		handler: commandRemoveStock,
		permissions: ['ADM'],
	},
	{
		alias: ['definirsaldo'],
		handler: commandDefineBalance,
		permissions: ['ADM'],
	},
	{
		alias: ['menu'],
		handler: commandMenu,
	},
	{
		alias: ['renovar'],
		handler: commandRenew,
		permissions: ['ADM'],
	},
	{
		alias: ['tokenmpmaster'],
		handler: commandTokenMPMaster,
		permissions: ['OWNER'],
	},
	{
		alias: ['precosemanal', 'preçosemana', 'precosemana', 'preçosemanal'],
		handler: commandPriceWeek,
		permissions: ['OWNER'],
	},
	{
		alias: ['block', 'bloquear', 'desblock', 'desbloquear'],
		handler: commandBlockBot,
		permissions: ['OWNER'],
	},
	{
		alias: ['bots'],
		handler: commandShowBots,
		permissions: ['OWNER'],
	},
	{
		alias: ['adduser', 'addusers'],
		handler: commandAddUsers,
		permissions: ['ADM'],
	},
	{
		alias: ['saldodobro', 'saldoemdobro'],
		handler: commandDoubleBalance,
		permissions: ['ADM'],
	},
	{
		alias: ['bonus'],
		handler: commandDefineBonus,
		permissions: ['ADM'],
	},
	{
		alias: ['notificaçõesfake', 'notificacoesfake', 'fakenotify'],
		handler: commandFakeNotify,
		permissions: ['ADM'],
	},
	{
		alias: ['manutencao', 'manutenção'],
		handler: commandMaintenance,
		permissions: ['ADM'],
	},
	{
		alias: ['removerbot', 'removebot'],
		handler: commandRemoveBot,
		permissions: ['OWNER'],
	},
	{
		alias: ['loginimg', 'imglogin', 'loginimagem', 'imagemlogin'],
		handler: commandImageLogin,
		permissions: ['ADM'],
	},
	{
		alias: ['logintext', 'textlogin', 'logintexto', 'textologin'],
		handler: commandDefineTextLogin,
		permissions: ['ADM'],
	}
];

export async function handlerCommand(client: Client, message: wppconnect.Message & { caption?: string }) {
	const text = message.caption || message.body;
	if (!text?.startsWith('/')) return false;

	const [name, ...args] = text.split(' ');
	const nameCmd = name.slice(1).toLowerCase();

	const command: Command = {
		name,
		args,
	};

	try {
		const cmdFound = commands.find((cmd) => cmd.alias.includes(nameCmd));
		if (!cmdFound) return false;

		if (cmdFound.permissions) {
			const userId = message.author || message.from;

			const owners = process.env.OWNER_PHONE?.split(',')?.map((owner) => `${owner.trim()}@c.us`) || [];

			const isOwner = owners.includes(userId);
			const isAdmin = await prisma.admins.findFirst({
				where: {
					wid: userId,
					bot: {
						wid: client.wid!,
					},
				},
			});
			const isOwnerBot = await prisma.bot.findUnique({
				where: {
					wid: client.wid!,
					owner: userId,
				},
			});

			if (cmdFound.permissions.includes('ADM') && !isAdmin && !isOwner && !isOwnerBot) {
				client.sendText(message.from, 'Acesso negado (1)!');
				return true;
			}

			if (cmdFound.permissions.includes('OWNER') && !isOwner) {
				client.sendText(message.from, 'Acesso negado (2)!');
				return true;
			}
		}

		await cmdFound.handler(client, message, command);
		return true;
	} catch (error) {
		await client.sendText(
			message.from,
			'Ocorreu um erro ao processar sua mensagem. Tente novamente ou entre em contato com o suporte.'
		);
		await notifyError(client, message, 'Command', error);
		return true;
	}
}
