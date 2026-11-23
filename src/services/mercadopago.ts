import mercadopago from 'mercadopago';

export async function pixCreate(mercadoPagoToken: string, amount: number) {
	try {
		if (!mercadoPagoToken) {
			return {
				status: false,
				message: 'Token não encontrado',
			};
		}

		mercadopago.configurations.setAccessToken(mercadoPagoToken);

		const rand = Math.floor(Math.random() * (9999 - 1000 + 1) + 1000);

		const res = await mercadopago.payment.create({
			installments: 0,
			payment_method_id: 'pix',
			transaction_amount: amount,
			description: '',
			payer: {
				email: `joseamauri${rand}@gmail.com`,
				entity_type: 'individual',
				type: 'customer',
				identification: {
					type: 'phone',
					number: `119931${rand}`,
				},
			},
		});

		if (res.body?.status !== 'pending') {
			return {
				status: false,
				message: 'Erro ao gerar pix',
				response: {
					status: res?.response?.status,
					qrcode: '',
				},
			};
		}

		return {
			status: true,
			message: 'Pix gerado com sucesso',
			response: {
				status: res.response?.status,
				qrcode: res?.response?.point_of_interaction?.transaction_data?.qr_code,
				id: res.response?.id
			},
		};
	} catch (error: any) {
		console.log(error);
		return {
			status: false,
			message: 'Error interno ao gerar pix',
		};
	}
}

export async function pixGet(mercadoPagoToken: string, id: number) {
	try {
		if (!mercadoPagoToken) {
			return {
				status: false,
				message: 'Token não encontrado',
			};
		}

		mercadopago.configurations.setAccessToken(mercadoPagoToken);

		const res = await mercadopago.payment.get(id);

		if (res.body?.status !== 'approved') {
			return {
				status: false,
				message: 'Pix não aprovado',
				response: {
					status: res?.response?.status,
					amount: res?.response?.transaction_amount,
				},
			};
		}

		return {
			status: true,
			message: 'Pix aprovado com sucesso',
			response: {
				status: res.response?.status,
				amount: res.response?.transaction_amount,
			},
		};
	} catch (error: any) {
		console.log(error);
		return {
			status: false,
			message: 'Error interno ao gerar pix',
		};
	}
}
