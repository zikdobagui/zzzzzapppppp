import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { loginSavedSessionFirst } from '../src/helpers/sessionLogin';
const { test }: typeof import('node:test') = createRequire(__filename)('node:test');

test('sessão autenticada é reutilizada sem pedir número nem gerar código', async () => {
	let prompts = 0;
	let evaluations = 0;
	const client = {
		options: {},
		statusFind: (_status: string, _session: string) => undefined,
		page: { evaluate: async (_script: string) => { evaluations++; } },
		waitForLogin: async () => { client.statusFind('isLogged', 'Principal'); return true; },
	};
	const original = client.statusFind;
	await loginSavedSessionFirst(client, async () => { prompts++; throw new Error('não deve pedir'); });
	assert.equal(prompts, 0);
	assert.equal(evaluations, 0);
	assert.equal(client.statusFind, original);
});

test('número só é solicitado após confirmar que a sessão não está autenticada', async () => {
	const events: string[] = [];
	let script = '';
	let paired!: () => void;
	const pairing = new Promise<void>((resolve) => { paired = resolve; });
	const client = {
		options: {} as { phoneNumber?: string },
		statusFind: (_status: string, _session: string) => undefined,
		page: { evaluate: async (value: string) => { script = value; events.push('code'); paired(); } },
		waitForLogin: async () => {
			events.push('checked');
			client.statusFind('notLogged', 'Principal');
			client.statusFind('notLogged', 'Principal');
			await pairing;
			return true;
		},
	};
	await loginSavedSessionFirst(client, async () => { events.push('prompt'); return '5511999999999'; });
	assert.deepEqual(events, ['checked', 'prompt', 'code']);
	assert.equal(client.options.phoneNumber, '5511999999999');
	assert.ok(script.includes('startLinkDeviceCodeForPhoneNumber("5511999999999")'));
});

test('número inválido falha sem ficar preso esperando autenticação', async () => {
	const client = {
		options: {},
		statusFind: (_status: string, _session: string) => undefined,
		page: { evaluate: async (_script: string) => { throw new Error('não deve chamar'); } },
		waitForLogin: async (): Promise<boolean> => {
			client.statusFind('notLogged', 'Principal');
			return new Promise(() => undefined);
		},
	};
	const original = client.statusFind;
	await assert.rejects(loginSavedSessionFirst(client, async () => 'invalid'), /código do país/);
	assert.equal(client.statusFind, original);
});
