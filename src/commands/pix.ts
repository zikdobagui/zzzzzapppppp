import { tryTelegramPix } from '../buttons/telegramWallet';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { pixCreate, pixGet } from '@/services/mercadopago';
import qr from 'qr-image';
import { notifyAdmin } from '@/helpers/notify';

export async function commandPix(client: Client, message: wppconnect.Message, command: Command) {
	if (await tryTelegramPix(client, message, command)) return;
	const amount = Number(command.args?.[0]?.replace(/[^\d.]/g, ''));

	if (!amount || amount <= 0) {
		client.sendText(
			message.from,
			'Você precisa informar um valor para o pix. Exemplo: /pix 10'
		);
		return;
	}

	const bot = await prisma.bot.findUnique({
		where: {
			wid: client.wid!,
		},
	});

	if (bot === null) {
		client.sendText(message.from, 'O bot não está configurado.');
		return;
	}

	if (amount < bot.pixMin) {
		client.sendText(
			message.from,
			`O valor mínimo para o pix é de R$ ${bot.pixMin.toFixed(2)}.`
		);
		return;
	}

	if (amount > bot.pixMax) {
		client.sendText(
			message.from,
			`O valor máximo para o pix é de R$ ${bot.pixMax.toFixed(2)}.`
		);
		return;
	}

	const user = await prisma.user.findFirst({
		where: {
			wid: message.author || message.from,
			bot: {
				wid: client.wid!,
			},
		},
	});

	if (user === null) {
		client.sendText(message.from, 'Você não está cadastrado no sistema.');
		return;
	}

	if (bot.pixType === 'manual') {
		if (!bot.pixManualKey) {
			client.sendText(
				message.from,
				'O pix manual não está configurado, entre em contato com o administrador.'
			);
			return;
		}

		await client.sendText(
			message.from,
			'*PIX MANUAL*\n\n' +
				`*Chave Pix:* ${bot.pixManualKey}\n` +
				`*Informações:* ${bot.pixManualAdditional}\n\n` +
				bot.textPixManual
		);
		await client.sendText(message.from, bot.pixManualKey);
		return;
	}

	const res = await pixCreate(bot.mercadoPagoToken, amount);
	if (res.status === false) {
		client.sendText(message.from, `ERRO: ${res.message}`);
		return;
	}

	const text =
		'*Pix gerado com sucesso*\n\n' +
		'```Copie e cole o codigo abaixo ou escaneie o QRCode abaixo no aplicativo do seu banco.\n' +
		'Você tem até 10 minutos para pagar.\n' +
		'Seu dinheiro sera adicionado na sua carteira de imediato.```\n' +
		`*Valor:* R$ ${amount.toFixed(2)}\n`;

	const png = qr.imageSync(res.response?.qrcode, { type: 'png' });
	let base64 = Buffer.from(png).toString('base64');
	base64 = `data:image/png;base64,${base64}`;

	await client.sendImageFromBase64(message.from, base64, 'qr_code.png', text);
	await client.sendText(message.from, res.response?.qrcode);

	const intervalId = setInterval(async () => {
		const resultPix = await pixGet(bot.mercadoPagoToken, Number(res.response?.id));
		if (resultPix.status === false) return;

		clearInterval(intervalId);
		const balanceDouble = bot.doubleBalance ? resultPix.response?.amount : 0;
		const balance = (user!.balance + resultPix.response?.amount) + balanceDouble;

		await prisma.user.update({
			where: {
				id: user!.id,
			},
			data: {
				balance: { increment: resultPix.response?.amount + balanceDouble },
				pixHistory: {
					create: {
						amount: resultPix.response?.amount,
						bot: {
							connect: {
								wid: client.wid!,
							},
						},
					},
				},
			},
		});

		if (user!.affiliated) {
			const balanceAffiliated = resultPix.response?.amount * 0.05;
			const userAffiliated = await prisma.user.findFirst({
				where: {
					wid: user!.affiliated,
					bot: {
						wid: client.wid!,
					}
				},
			});

			if (userAffiliated) {
				await prisma.user.update({
					where: {
						id: userAffiliated.id,
					},
					data: {
						balance: {
							increment: balanceAffiliated,
						},
					},
				});
			}
		}

		const text =
			'*Pix aprovado*\n\n' +
			`*Valor:* R$ ${resultPix.response?.amount?.toFixed(2)}\n` +
			'Valor adicionado na carteira com sucesso.';

		await client.sendImage(message.from, './assets/pix.jpeg', 'pix.jpeg', text);

		notifyAdmin(
			client,
			`Usuário ${
				message.author || message.from
			} adicionou saldo via pix de R$ ${resultPix.response?.amount?.toFixed(2)}`
		);
	}, 5000);

	setTimeout(async () => {
		clearInterval(intervalId);

		await client.sendText(
			message.from,
			'Você demorou demais para pagar o pix. E a operação foi cancelada!'
		);
		notifyAdmin(
			client,
			`Usuário ${message.author || message.from} não pagou o pix de R$ ${amount.toFixed(2)}`
		);
	}, 60 * 1000 * 10);
}
