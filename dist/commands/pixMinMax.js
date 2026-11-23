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

// src/commands/pixMinMax.ts
var pixMinMax_exports = {};
__export(pixMinMax_exports, {
  commandDefinePix: () => commandDefinePix
});
module.exports = __toCommonJS(pixMinMax_exports);

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

// src/commands/pixMinMax.ts
async function commandDefinePix(client, message, command) {
  const [min, max] = command.args;
  if (!min || !max) {
    client.sendText(message.from, "Voc\xEA precisa informar o valor m\xEDnimo e m\xE1ximo.\n\nExemplo: /pixvalor 3 100");
    return;
  }
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      pixMin: Number(min),
      pixMax: Number(max)
    }
  });
  await client.sendText(message.from, `O valor m\xEDnimo e m\xE1ximo do PIX foi atualizado com sucesso

Valor m\xEDnimo: *${min}*
Valor m\xE1ximo: *${max}*`);
  notifyAdmin(client, `Admin ${message.author || message.from} atualizou o valor m\xEDnimo e m\xE1ximo do PIX

Valor m\xEDnimo: *${min}*
Valor m\xE1ximo: *${max}*`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandDefinePix
});
