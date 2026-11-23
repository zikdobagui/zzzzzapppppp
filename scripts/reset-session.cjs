require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { rm } = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const prisma = new PrismaClient();
  try {
    const phone = process.env.BOT_PHONE;
    if (!phone || !/^[1-9]\d{9,14}$/.test(phone)) {
      throw new Error('Configure BOT_PHONE no .env com país, DDD e número, somente dígitos.');
    }
    const bot = await prisma.bot.findUnique({ where: { wid: `${phone}@c.us` } });
    const session = bot?.name || 'Principal';
    const root = path.resolve('tokens');
    if (!session || session === '.' || session === '..' || /[\\/:]/.test(session)) {
      throw new Error('Nome de sessão inválido; limpeza cancelada.');
    }
    for (const name of [session, `${session}.data.json`]) {
      const target = path.resolve(root, name);
      if (path.dirname(target) !== root) throw new Error('Caminho de sessão inválido.');
      await rm(target, { recursive: true, force: true });
    }
    console.log(`Sessão local "${session}" removida. Execute npm start para conectar pelo número.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Não foi possível remover a sessão:', error.message);
  process.exitCode = 1;
});
