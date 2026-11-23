// Executado na Square Cloud, com o codigo ja compilado pelo GitHub Actions.
const { spawnSync } = require('node:child_process');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');

process.chdir(path.join(__dirname, '..'));
process.env.NODE_ENV = 'production';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

// O commit preserva node_modules. Reinstala quando o lockfile mudar,
// inclusive depois de uma atualizacao de dependencias ou de um rollback.
const lockHash = createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
const marker = 'node_modules/.squarecloud-lock';
if (!existsSync(marker) || readFileSync(marker, 'utf8') !== lockHash) {
  console.log('Atualizando dependencias da aplicacao...');
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--include=dev']);
  writeFileSync(marker, lockHash);
}

// Gera o cliente para Linux, sem copiar binarios do computador Windows.
run(process.execPath, ['node_modules/prisma/build/index.js', 'generate']);
// Alteracoes do banco devem ser aplicadas separadamente, com backup.
require('../dist/index.js');
