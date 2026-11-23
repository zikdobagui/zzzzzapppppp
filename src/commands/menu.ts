import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client } from '@/types/client';
import { menu } from '@/events/menu';

export async function commandMenu(client: Client, message: wppconnect.Message) {
	await menu(client, message);
}
