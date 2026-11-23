type SessionClient = {
	statusFind?: (status: any, session: string) => void;
	options: { phoneNumber?: string };
	page: { evaluate: (script: string) => Promise<unknown> };
	waitForLogin: () => Promise<boolean>;
};

export async function loginSavedSessionFirst(client: SessionClient, requestPhone: () => Promise<string>) {
	const previousStatus = client.statusFind;
	let pairingStarted = false;
	let rejectPairing!: (error: unknown) => void;
	const pairingFailure = new Promise<never>((_resolve, reject) => { rejectPairing = reject; });
	client.statusFind = (status, session) => {
		previousStatus?.(status, session);
		// A biblioteca já verificou a autenticação da sessão neste ponto.
		if (status !== 'notLogged' || pairingStarted) return;
		pairingStarted = true;
		(async () => {
			const phone = await requestPhone();
			if (!/^[1-9]\d{9,14}$/.test(phone)) {
				throw new Error('Informe o código do país, DDD e número, somente com dígitos.');
			}
			client.options.phoneNumber = phone;
			await client.page.evaluate(`
			(async () => {
				WPP.on('conn.link_code_change', window.onLinkCode);
				WPP.on('conn.link_code_expired', window.onLinkCodeExpired);
				WPP.on('conn.link_code_error', error => window.onLinkCodeError(error.message));
				await WPP.conn.startLinkDeviceCodeForPhoneNumber(${JSON.stringify(phone)});
			})()
			`);
		})().catch(rejectPairing);
	};
	try {
		if (!await Promise.race([client.waitForLogin(), pairingFailure])) {
			throw new Error('Não foi possível autenticar a sessão do WhatsApp.');
		}
	} finally {
		client.statusFind = previousStatus;
	}
}
