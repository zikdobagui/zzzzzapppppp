import { Bot } from '@prisma/client';
import * as wppconnect from '@wppconnect-team/wppconnect';

export interface Client extends wppconnect.Whatsapp {
	wid?: string;
	db?: Bot | null;
}

type selectedOptions = {
	name: string;
	localId: 1;
} | null;

type Wid = wppconnect.Wid & string;

export interface PollResponse {
	msgId: {
		fromMe: boolean;
		id: string;
		remote: string;
		_serialized: string;
	};
	chatId: Wid;
	selectedOptions: selectedOptions[];
	timestamp: number;
	sender: Wid;
	selected?: {
		added?: string;
		removed?: string;
	};
}

export type Command = {
	name: string;
	args: string[];
};

export type CommandsList = {
	alias: string[];
	handler: (client: Client, message: wppconnect.Message, command: Command) => void;
	permissions?: string[];
};
