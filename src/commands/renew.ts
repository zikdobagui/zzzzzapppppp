import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import prisma from '@/services/prisma';
import { pixCreate, pixGet } from '@/services/mercadopago';
import qr from 'qr-image';

export async function commandRenew(client: Client, message: wppconnect.Message, command: Command) {
	const [_week] = command.args;
	const week = Number(_week);


	if (!week || week <= 0) {
		await client.sendText(
			message.from,
			'Você precisa informar a quantidade de semanas. Exemplo: /renovar 1'
		);
		return;
	}

	const botMaster = await prisma.botMaster.findFirst();
	if (!botMaster) return;


	const userId = message.author || message.from;
	
	const owners = process.env.OWNER_PHONE?.split(',')?.map((owner) => `${owner.trim()}@c.us`) || [];
	const isOwner = owners.includes(userId);

	if (isOwner) {
		const date = new Date();
		date.setDate(date.getDate() + week * 7);

		await prisma.bot.update({
			where: {
				wid: client.wid!,
			},
			data: {
				expireAt: date,
			},
		});

		const text =
			'*Bot Renovado com sucesso!*\n\n' +
			`*Data de expiração:* ${date.toLocaleString('pt-BR')}`;
		client.sendText(message.from, text);

		return;
	}

	const amount = botMaster.priceWeek * week;
	const res = await pixCreate(botMaster.mercadoPagoToken, amount);
	if (res.status === false) {
		client.sendText(message.from, `ERRO: ${res.message}`);
		return;
	}

	const text =
		'*Pix gerado com sucesso*\n\n' +
		'```Copie e cole o codigo abaixo ou escaneie o QRCode abaixo no aplicativo do seu banco.' +
		'Você tem até 10 minutos para pagar.\n' +
		'Seu bot será renovado automaticamente.```\n' +
		`*Valor:* R$ ${amount.toFixed(2)}\n`;

	await client.sendText(message.from, text);

	const png = qr.imageSync(res.response?.qrcode, { type: 'png' });
	let base64 = Buffer.from(png).toString('base64');

	base64 = `data:image/png;base64,${base64}`;

	await client.sendImageFromBase64(message.from, base64, 'qr_code');
	await client.sendText(message.from, res.response?.qrcode);

	const intervalid = setInterval(async () => {
		const resultPix = await pixGet(botMaster.mercadoPagoToken, Number(res.response?.id));

		if (resultPix.status === true) {
			clearInterval(intervalid);

			const date = new Date();
			date.setDate(date.getDate() + week * 7);

			await prisma.bot.update({
				where: {
					wid: client.wid!,
				},
				data: {
					expireAt: date,
				},
			});

			const text =
				'*Bot Renovado com sucesso!*\n\n' +
				`*Valor:* R$ ${resultPix.response?.amount?.toFixed(2)}\n` +
				`*Data de expiração:* ${date.toLocaleString('pt-BR')}`;
			client.sendText(message.from, text);
		}
	}, 5000);

	setTimeout(() => {
		clearInterval(intervalid);

		client.sendText(message.from, 'O pix expirou.');
	}, 60 * 1000 * 10);
}
