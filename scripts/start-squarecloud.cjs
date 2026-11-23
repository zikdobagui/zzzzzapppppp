// Executado na Square Cloud, com o codigo ja compilado pelo GitHub Actions.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

process.chdir(path.join(__dirname, '..'));
process.env.NODE_ENV = 'production';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

// A Square Cloud instala as dependencias antes do start. Nao executar npm ci
// aqui: ele apaga node_modules e provoca outra instalacao a cada falha/restart.

// Gera o cliente para Linux, sem copiar binarios do computador Windows.
run(process.execPath, ['node_modules/prisma/build/index.js', 'generate']);
// Alteracoes do banco devem ser aplicadas separadamente, com backup.
require('../dist/index.js');
