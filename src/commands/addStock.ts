import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client, Command } from '@/types/client';
import { PrismaClient } from '@prisma/client';
import { notifyAdmin } from '@/helpers/notify';

const prisma = new PrismaClient();

export async function commandAddStock(
	client: Client,
	message: wppconnect.Message,
	command: Command
) {
	const [name, ...lines] = command.args.join(' ').split(/\r?\n/);

	const logins = lines
		.map((line) => {
			const [user, password, ...rest] = line.split(/\||:/);
			const additional = rest.join(' ');
			return { user, password, additional };
		})
		.filter((login) => login.user && login.password);

	if (!name && logins.length === 0) {
		client.sendText(
			message.from,
			'Nenhum login foi informado\n\nExemplo: /add Netflix\ntest|12345|adicional\ntest2|12345|adicional',
			{
				quotedMsg: message.id,
			}
		);
		return;
	}

	const count = {
		success: 0,
		error: 0,
	};

	for (const { user, password, additional } of logins) {
		const stocks = await prisma.logins.create({
			data: {
				name,
				user,
				password,
				additional,
				bot: {
					connect: {
						wid: client.wid,
					},
				},
				setting: {
					connectOrCreate: {
						where: {
							name,
						},
						create: {
							name,
							bot: {
								connect: {
									wid: client.wid,
								},
							},
						},
					},
				},
			},
		});

		if (stocks) {
			count.success++;
		} else {
			count.error++;
		}
	}

	client.sendText(message.from, `Foram adicionados ${count.success} logins e ${count.error} falharam`);
	await notifyAdmin(client, `Foram adicionados ${count.success} logins e ${count.error} falharam`);
}
