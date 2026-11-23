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

// src/commands/bonus.ts
var bonus_exports = {};
__export(bonus_exports, {
  commandDefineBonus: () => commandDefineBonus
});
module.exports = __toCommonJS(bonus_exports);

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

// src/commands/bonus.ts
async function commandDefineBonus(client, message, command) {
  const arg = command.args?.[0]?.replace(/[^\d.]/g, "");
  const amount = Number(arg);
  if (!arg || isNaN(amount) || amount < 0) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o valor do bon\xFAs. Para desativar deixe o valor como *0*. Exemplo: */bonus 10*"
    );
    return;
  }
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      bonus: amount
    }
  });
  await client.sendText(message.from, `O valor do bon\xFAs foi atualizado para *${amount}*.`);
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} atualizou o valor do bon\xFAs para *${amount}*.`
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandDefineBonus
});
