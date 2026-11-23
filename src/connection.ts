import { installWhatsAppCompatibility } from './helpers/whatsappCompatibility';
import { Bot } from '@prisma/client';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { loginSavedSessionFirst } from './helpers/sessionLogin';

export type CreateBotOptions = Omit<wppconnect.CreateOptions, 'session'>;

export async function createBot(bot: Bot | null, options?: CreateBotOptions) {
	const logger = wppconnect.defaultLogger;
	const session = bot?.name || 'Principal';
	const codeMode = !options?.catchQR;
	const requestPhone = async () => {
		let phoneNumber = options?.phoneNumber || (session === 'Principal'
			? process.env.WA_PAIRING_PHONE?.trim() || process.env.BOT_PHONE?.trim()
			: bot?.wid.split('@')[0]);
		if (session === 'Principal' && stdin.isTTY) {
			const terminal = createInterface({ input: stdin, output: stdout });
			try {
				console.log('A sessão não está autenticada. Conecte pelo código para salvar uma nova sessão.');
				const answer = await terminal.question(`Número do WhatsApp com país e DDD${phoneNumber ? ` (Enter para usar ${phoneNumber})` : ''}: `);
				phoneNumber = answer.trim() ? answer.replace(/\D/g, '') : phoneNumber;
			} finally {
				terminal.close();
			}
		}
		if (!phoneNumber) throw new Error('Para gerar o código, informe o número no terminal ou configure WA_PAIRING_PHONE no .env.');
		return phoneNumber;
	};

	if (process.env.NODE_ENV === 'production') {
		// logger.silent = true;
		logger.level = 'http';
	}

	const client = await wppconnect.create({
		session,
		logger,
		useChrome: true,
		headless: true,
		logQR: false,
		catchLinkCode: (code) => {
			console.log(`\nCódigo de conexão do bot "${session}": ${code}\nNo WhatsApp do número informado, abra Aparelhos conectados > Conectar um aparelho > Conectar com número de telefone e digite o código acima.\n`);
		},
		catchQR: (_base64, asciiQR) => {
			console.log(`\nQR Code do bot "${session}" — no WhatsApp, abra Aparelhos conectados > Conectar um aparelho e escaneie:\n${asciiQR}`);
		},
		autoClose: 0,
		deviceSyncTimeout: 0,
		updatesLog: true,
		browserArgs: [
			'--log-level=3',
			'--no-default-browser-check',
			'--disable-site-isolation-trials',
			'--no-experiments',
			'--ignore-gpu-blacklist',
			'--ignore-certificate-errors',
			'--ignore-certificate-errors-spki-list',
			'--disable-gpu',
			'--disable-extensions',
			'--disable-default-apps',
			'--enable-features=NetworkService',
			'--disable-setuid-sandbox',
			'--no-sandbox',
			// Extras
			'--disable-webgl',
			'--disable-threaded-animation',
			'--disable-threaded-scrolling',
			'--disable-in-process-stack-traces',
			'--disable-histogram-customizer',
			'--disable-gl-extensions',
			'--disable-composited-antialiasing',
			'--disable-canvas-aa',
			'--disable-3d-apis',
			'--disable-accelerated-2d-canvas',
			'--disable-accelerated-jpeg-decoding',
			'--disable-accelerated-mjpeg-decode',
			'--disable-app-list-dismiss-on-blur',
			'--disable-accelerated-video-decode',
		],
		disableWelcome: true,
		waitForLogin: true,
		puppeteerOptions: {
			userDataDir: `./tokens/${session}`,
		},
		...options,
		...(codeMode ? { phoneNumber: undefined, waitForLogin: false, catchQR: () => undefined } : {}),
	});
	if (codeMode) {
		try {
			await loginSavedSessionFirst(client, requestPhone);
		} catch (error) {
			await client.close().catch(() => undefined);
			throw error;
		}
		let reconnecting: Promise<void> | undefined;
		client.onStateChange(async () => {
			try {
				if (!await client.page.evaluate('WPP.conn.isRegistered()') && !reconnecting) {
					reconnecting = loginSavedSessionFirst(client, requestPhone).finally(() => { reconnecting = undefined; });
					await reconnecting;
					await installWhatsAppCompatibility(client);
				}
			} catch (error) {
				console.error(`Falha ao reconectar a sessão "${session}":`, error instanceof Error ? error.message : 'erro de conexão');
			}
		});
	}

	await installWhatsAppCompatibility(client);
	return Object.assign(client, { db: bot });
}
