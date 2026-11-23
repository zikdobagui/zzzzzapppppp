"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/commands/adm.ts
var adm_exports = {};
__export(adm_exports, {
  commandAdmin: () => commandAdmin
});
module.exports = __toCommonJS(adm_exports);

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

// src/commands/adm.ts
async function commandAdmin(client, message) {
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    },
    include: {
      admins: {
        select: {
          wid: true
        }
      },
      _count: {
        select: {
          users: true,
          loginsHistory: true,
          logins: true
        }
      },
      pixHistory: true,
      gifts: {
        where: {
          redeemed: true
        }
      }
    }
  });
  if (!bot)
    return;
  const textOwner = "*/newbot* - Cria um novo bot\n*/reconnect* - Reconecta um bot\n*/block* - Bloqueia e desbloqueia um bot\n*/tokenmpmaster* - Define o token do Mercado Pago Master\n*/precosemanal* - Define o pre\xE7o semanal\n*/removerbot* - Remove um bot\n*/bots* - Listar todos os bots\n\n";
  const owners = process.env.OWNER_PHONE?.split(",")?.map((owner) => `${owner.trim()}@c.us`) || [];
  const isOwner = owners.includes(message.author || message.from);
  const listAdmins = bot.admins.map(({ wid }) => wid.replace(/\D/g, "")).join(", ");
  const pixToday = bot.pixHistory.filter((pix) => {
    const date = /* @__PURE__ */ new Date();
    date.setHours(0, 0, 0, 0);
    return pix.createAt >= date;
  }).reduce((acc, { amount }) => acc + amount, 0);
  const pixWeek = bot.pixHistory.filter((pix) => {
    const date = /* @__PURE__ */ new Date();
    date.setDate(date.getDate() - 7);
    date.setHours(0, 0, 0, 0);
    return pix.createAt >= date;
  }).reduce((acc, { amount }) => acc + amount, 0);
  const pixMonth = bot.pixHistory.filter((pix) => {
    const date = /* @__PURE__ */ new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return pix.createAt >= date;
  }).reduce((acc, { amount }) => acc + amount, 0);
  const pixTotal = bot.pixHistory.reduce((acc, { amount }) => acc + amount, 0);
  const largerPix = bot.pixHistory.reduce((acc, { amount }) => Math.max(acc, amount), 0);
  const giftTotal = bot.gifts.reduce((acc, { amount }) => acc + amount, 0);
  const largerGift = bot.gifts.reduce((acc, { amount }) => Math.max(acc, amount), 0);
  const text = `*Painel Admin*

*Dono:* ${bot.owner.replace(/\D/g, "")}
*Lista de Admins:* ${listAdmins}

*Data de expira\xE7\xE3o:* ${bot.expireAt.toLocaleString("pt-BR")}

*PIX:*
*Tipo do PIX:* ${bot.pixType}
*Token Mercado Pago:* ${bot.mercadoPagoToken || "SEM TOKEN"}
*Chave Pix Manual:* ${bot.pixManualKey}
*Informa\xE7\xF5es Adicional Pix Manual:* ${bot.pixManualAdditional}
*PIX de Hoje:* R$ ${pixToday.toFixed(2)}
*PIX da Semana:* R$ ${pixWeek.toFixed(2)}
*PIX do M\xEAs:* R$ ${pixMonth.toFixed(2)}
*PIX Total:* R$ ${pixTotal.toFixed(2)}
*Maior PIX Inserido:* R$ ${largerPix.toFixed(2)}

*Usu\xE1rios Registrados:* ${bot._count.users}

*Logins no estoque:* ${bot._count.logins}
*Logins vendidos:* ${bot._count.loginsHistory}

*Gifts Resgatados:* R$ ${giftTotal.toFixed(2)}
*Maior Gift Resgatado:* R$ ${largerGift.toFixed(2)}

*Comandos Administrativos:*
( _Para saber mais sobre um comando, apenas execute o mesmo._ )

${isOwner ? textOwner : ""}*/add* - Adiciona estoque de logins
*/text* - Define o texto de um menu
*/pixvalor* - Define o valor m\xEDnimo e m\xE1ximo do PIX
*/notificacao* - Ativa ou desativa as notifica\xE7\xF5es
*/gift* - Cria um gift
*/addadmin* - Adiciona um administrador
*/removeradmin* - Remove um administrador
*/id* - Mostra o ID do chat
*/preco* - Define o pre\xE7o de um login
*/tokenmp* - Define o token do Mercado Pago
*/pixtipo* - Define o tipo de PIX(manual ou automatico)
*/pixmanual* - Define a chave do PIX manual
*/spam* - Envia uma mensagem para todos os usu\xE1rios
*/removerstock* - Remove um estoque de logins
*/definirsaldo* - Define o saldo de um usu\xE1rio
*/renovar* - Renovar aluguel do bot
*/adduser* - Adiciona usu\xE1rios para fazer spam
*/saldodobro* - Define o saldo em dobro a cada pix
*/bonus* - Define o valor do b\xF4nus usuario novato
*/manutencao* - Ativa ou desativa a manuten\xE7\xE3o
*/notificacoesfake* - Ativa ou desativa as notifica\xE7\xF5es de vendas fake
*/loginimg* - Define a imagem de um login
*/logintext* - Define o texto de um login`;
  client.sendText(message.from, text);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandAdmin
});
