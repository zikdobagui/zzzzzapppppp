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

// src/commands/tokenMP.ts
var tokenMP_exports = {};
__export(tokenMP_exports, {
  commandTokenMP: () => commandTokenMP
});
module.exports = __toCommonJS(tokenMP_exports);

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

// src/helpers/notify.ts
async function notifyAdmin(client, text) {
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    },
    include: {
      admins: {
        select: {
          wid: true
        }
      }
    }
  });
  if (!bot.admins)
    return;
  if (!bot?.admins?.find((admin) => admin.wid === bot.owner)) {
    bot?.admins?.push({ wid: bot.owner });
  }
  for (const { wid } of bot.admins) {
    await client.sendText(wid, text);
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  }
}

// src/commands/tokenMP.ts
async function commandTokenMP(client, message, command) {
  const tokenMp = command.args.join(" ");
  if (!tokenMp) {
    client.sendText(message.from, "Voc\xEA precisa informar o token do Mercado Pago.\n\nExemplo: /tokenMP 1234567890");
    return;
  }
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      mercadoPagoToken: tokenMp
    }
  });
  await client.sendText(message.from, `Token do Mercado Pago atualizado com sucesso

Token: *${tokenMp}*`);
  notifyAdmin(client, `Admin ${message.author || message.from} atualizou o token do Mercado Pago

Token: *${tokenMp}*`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandTokenMP
});
