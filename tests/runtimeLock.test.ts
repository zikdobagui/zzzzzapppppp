import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { acquireRuntimeLock } from '../src/helpers/runtimeLock';
const { test }: typeof import('node:test') = createRequire(__filename)('node:test');

test('impede duas instâncias e libera a trava para reiniciar', () => {
 const dir = mkdtempSync(path.join(tmpdir(), 'bot-lock-'));
 const file = path.join(dir, 'bot.lock');
 try {
  const release = acquireRuntimeLock(file);
  assert.throws(() => acquireRuntimeLock(file), /já está em execução/);
  release();
  assert.equal(existsSync(file), false);
  acquireRuntimeLock(file)();
 } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('trava incompleta não permite iniciar outra instância', () => {
 const dir = mkdtempSync(path.join(tmpdir(), 'bot-lock-'));
 const file = path.join(dir, 'bot.lock');
 try {
  writeFileSync(file, '');
  assert.throws(() => acquireRuntimeLock(file), /inválida/);
 } finally { rmSync(dir, { recursive: true, force: true }); }
});
