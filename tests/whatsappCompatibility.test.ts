import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { patchLidUserPrefs, installWhatsAppCompatibility } from '../src/helpers/whatsappCompatibility';
const { test }: typeof import('node:test') = createRequire(__filename)('node:test');

test('getter ausente é adaptado sem trocar LID pelo telefone; instalação é idempotente', () => {
 const lid = { _serialized: 'example@lid' };
 const prefs: Record<string, any> = { getMaybeMeLidUser() { return this.lid; }, lid };
 assert.equal(patchLidUserPrefs(prefs), true);
 assert.equal(prefs.getMeLidUserOrThrow(), lid);
 assert.equal(patchLidUserPrefs(prefs), false);
 prefs.lid = undefined;
 assert.throws(() => prefs.getMeLidUserOrThrow(), /LID/);
});

test('getter nativo é preservado e formato antigo também é aceito', () => {
 const native = () => 'native';
 const prefs = { getMeLidUserOrThrow: native };
 assert.equal(patchLidUserPrefs(prefs), false);
 assert.equal(prefs.getMeLidUserOrThrow, native);
 const old: Record<string, any> = { getMaybeMeLid: () => 'old@lid' };
 patchLidUserPrefs(old);
 assert.equal(old.getMeLidUserOrThrow(), 'old@lid');
 assert.throws(() => patchLidUserPrefs({}), /indisponível/);
});

test('script injetado no navegador é autossuficiente', async () => {
 const prefs = { getMaybeMeLidUser: () => 'my@lid' } as Record<string, any>;
 await installWhatsAppCompatibility({ page: { evaluate: async script => new Function('WPP', `return ${script}`)({ whatsapp: { UserPrefs: prefs } }) } });
 assert.equal(prefs.getMeLidUserOrThrow(), 'my@lid');
});
