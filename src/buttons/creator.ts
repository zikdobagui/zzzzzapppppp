import { Client, PollResponse } from '@/types/client';

export async function creator(client: Client, data: PollResponse) {
	client.sendText(data.chatId, 'Criador do Bot');
}