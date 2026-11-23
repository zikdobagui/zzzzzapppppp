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

// src/commands/bots.ts
var bots_exports = {};
__export(bots_exports, {
  commandShowBots: () => commandShowBots
});
module.exports = __toCommonJS(bots_exports);

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

// src/commands/bots.ts
async function commandShowBots(client, message) {
  const bots = await prisma_default.bot.findMany({
    select: {
      wid: true,
      owner: true,
      expireAt: true,
      name: true,
      admins: {
        select: {
          wid: true
        }
      },
      _count: {
        select: {
          users: true
        }
      }
    }
  });
  let text = "*Lista de Todos os Bots:*\n\n";
  for (const bot of bots) {
    const admins = bot.admins.map(({ wid }) => wid.replace(/\D/g, "")).join(", ");
    text += `*Nome:* ${bot.name}
*N\xFAmero:* ${bot.wid.replace(/\D/g, "")}
*Dono:* ${bot.owner.replace(/\D/g, "")}
*Expira em:* ${bot.expireAt?.toLocaleString()}
*Usu\xE1rios:* ${bot._count.users}
*Admins:* ${admins}

`;
  }
  client.sendText(message.from, text.trim());
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandShowBots
});
