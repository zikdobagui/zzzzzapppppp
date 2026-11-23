import { showTelegramLogins, responseTelegramLogin } from './telegramWallet';
import { notifySales } from '@/commands/notifySales';
import { notifyAdmin } from '@/helpers/notify';
import { Client, PollResponse } from '@/types/client';
import { PrismaClient } from '@prisma/client';
import { rmSync, writeFileSync } from 'fs';
import { usesStockApi, showApiLogins, responseApiLogin } from './apiLogins';

const prisma = new PrismaClient();

const pagination: Record<string, number> = {};
const limit = 8;

export async function showLogins(client: Client, data: PollResponse, offset = 0) {
	if (await showTelegramLogins(client, data, offset)) return;
	if (usesStockApi(client)) return showApiLogins(client, data, offset);
	pagination[data.sender] = offset;

	const logins = await prisma.loginsSettings.findMany({
		where: {
			bot: {
				wid: client.wid,
			},
		},
		select: {
			_count: {
				select: {
					logins: true,
				},
			},
			name: true,
			price: true,
		},
		skip: offset,
		take: limit,
	});

	if (logins.length === 0) {
		const text = offset === 0 ? 'Sem logins a venda.' : 'Fim da lista de logins.';
		client.sendText(data.chatId, text);
		return;
	}

	const listLogins: string[] = [];

	for (const { name, price, _count } of logins) {
		if (_count.logins === 0) continue;

		const text = `${name} - R$ ${price} - Estoque: ${_count.logins}`;
		if (!listLogins.includes(text)) listLogins.push(text);
	}

	if (listLogins.length === 0) {
		client.sendText(data.chatId, 'Sem estoque de logins.');
		return;
	}

	if (offset === 0) listLogins.push('Proximo');
	else listLogins.push('Proximo', 'Anterior');

	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid,
		},
	});

	const user = await prisma.user.findFirst({
		where: {
			wid: data.sender,
			bot: {
				wid: client.wid,
			},
		},
	});

	const text =
		'*◆ ━━━━❪✪❫━━━━ ◆*\n' +
		`*◆ Seu saldo: R$ ${user?.balance}*\n` +
		'*◆ ━━━━❪✪❫━━━━ ◆*\n\n' +
		`${bot?.textLogin}`;

	await client.sendPollMessage(data.chatId, text.trim(), listLogins, {
		selectableCount: 1,
	});
}

export async function responseBuyLogin(client: Client, data: PollResponse) {
	if (await responseTelegramLogin(client, data)) return;
	if (usesStockApi(client)) return responseApiLogin(client, data);
	if (!data.selected?.added) return;
	const { added: selected } = data.selected;

	if (selected === 'Proximo') {
		const offset = pagination[data.sender] || 0;
		pagination[data.sender] = offset + limit;

		await showLogins(client, data, pagination[data.sender]);
		return;
	}

	if (selected === 'Anterior') {
		const offset = pagination[data.sender] || 0;
		pagination[data.sender] = Math.max(0, offset - limit);

		await showLogins(client, data, pagination[data.sender]);
		return;
	}

	const logins = await prisma.loginsSettings.findMany({
		where: {
			bot: {
				wid: client.wid,
			},
		},
	});

	if (logins.length === 0) {
		client.sendText(data.chatId, 'Sem estoque de logins.');
		return;
	}

	const login = logins.find((item) => {
		const [name] = selected.split(' - ');
		return name === item.name;
	});

	if (!login) {
		client.sendText(data.chatId, 'Login não encontrado.');
		return;
	}

	if (login.price === 0) {
		client.sendText(data.chatId, 'Login não configurado.');
		return;
	}

	const user = await prisma.user.findFirst({
		where: {
			wid: data.sender,
			bot: {
				wid: client.wid,
			},
		},
	});

	if (!user) {
		client.sendText(data.chatId, 'Você não está cadastrado no sistema.');
		return;
	}

	if (user.balance < login.price) {
		client.sendText(data.chatId, 'Você não tem saldo suficiente.');
		return;
	}

	const firstLogin = await prisma.logins.findFirst({
		where: {
			name: login.name,
		},
	});

	if (!firstLogin) {
		client.sendText(data.chatId, 'Sem estoque desse login.');
		return;
	}

	await prisma.user.update({
		where: {
			id: user.id,
		},
		data: {
			balance: user.balance - login.price,
			loginsHistory: {
				create: {
					loginName: login.name,
					loginUser: firstLogin.user,
					loginPassword: firstLogin.password,
					loginAdditional: firstLogin.additional,
					loginPrice: login.price,
					bot: {
						connect: {
							wid: client.wid,
						},
					},
				},
			},
		},
	});

	await prisma.logins.delete({
		where: {
			id: firstLogin.id,
		},
	});

	const now = new Date();
	now.setMonth(now.getMonth() + 1);
	const nextMonth = now.toLocaleString('pt-BR');

	const text =
		'*📱 LOGIN COMPRADO COM SUCESSO 📱*\n\n' +
		`*📅 DATA RENOVAÇÃO:* ${nextMonth}\n\n` +
		`⚜ ${login.name} ⚜\n\n` +
		`*👤 Usuário:* ${firstLogin.user}\n` +
		`*🔑 Senha:* ${firstLogin.password}\n` +
		(firstLogin.additional ? `*ℹ️ Informações Adicional:* ${firstLogin.additional}` : '') +
		(login.text ? `\n\n${login.text}` : '');

	const textAdmin =
		'*🛍️ VENDA 🛍️*\n\n' +
		`Usuário: wa.me/${data.sender.replace(/\D/g, '')}\n` +
		`Saldo antes: R$ ${user.balance.toFixed(2)}\n` +
		`Saldo depois: R$ ${(user.balance - login.price).toFixed(2)}\n\n` +
		`⚜ Login: ${login.name}\n` +
		`*📅 DATA RENOVAÇÃO:* ${nextMonth}\n` +
		`*👤 Usuário:* ${firstLogin.user}\n` +
		`*🔑 Senha:* ${firstLogin.password}\n` +
		(firstLogin.additional ? `*ℹ️ Informações Adicional:* ${firstLogin.additional}` : '');

	let filename = './assets/login.jpeg';
	if (login.image) {
		filename = `./assets/${Date.now()}.png`;
		writeFileSync(filename, login.image);
	}

	await client.sendImage(data.chatId, filename, 'login.jpeg', text.trim());
	await notifySales(client, login, user.wid);

	if (login.image) rmSync(filename);

	notifyAdmin(client, textAdmin.trim());
}
