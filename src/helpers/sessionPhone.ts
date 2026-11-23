import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function saveBotPhone(phone: string) {
	if (!/^[1-9]\d{9,14}$/.test(phone)) throw new Error('Número de sessão inválido.');
	const filename = path.resolve('.env');
	let contents = '';
	try {
		contents = await readFile(filename, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	const setting = /^\s*(?:export[ \t]+)?BOT_PHONE[ \t]*=[^\r\n]*/gm;
	if (setting.test(contents)) {
		contents = contents.replace(setting, `BOT_PHONE=${phone}`);
	} else {
		contents += `${contents && !contents.endsWith('\n') ? '\n' : ''}BOT_PHONE=${phone}\n`;
	}
	await writeFile(filename, contents, 'utf8');
}
