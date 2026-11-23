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
async function start() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  let tables;
  try {
    tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
  } finally {
    await prisma.$disconnect();
  }
  if (tables.length === 0) {
    console.log('Banco vazio: criando tabelas com as migrations do projeto...');
    run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  } else if (!tables.some(table => table.name === 'Bot')) {
    throw new Error('Banco existente sem a tabela Bot. Os dados foram preservados; confira as migrations antes de continuar.');
  }
  // Bancos existentes exigem migracao planejada; nunca resetar automaticamente.
  require('../dist/index.js');
}

start().catch(error => {
  console.error('Falha ao preparar a aplicacao:', error.message);
  process.exitCode = 1;
});
