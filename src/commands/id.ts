import * as wppconnect from '@wppconnect-team/wppconnect';
import { Client } from '@/types/client';

export async function commandID(client: Client, message: wppconnect.Message) {
	client.sendText(message.from, `ID: ${message.from}`);
}
