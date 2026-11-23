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

// src/commands/gift.ts
var gift_exports = {};
__export(gift_exports, {
  commandGift: () => commandGift
});
module.exports = __toCommonJS(gift_exports);

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

// src/commands/gift.ts
async function commandGift(client, message, command) {
  const [amountStr] = command.args;
  const amount = Number(amountStr);
  if (Number.isNaN(amount)) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o valor do gift.\n\nExemplo: /gift 10"
    );
    return;
  }
  const code = (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)).toUpperCase();
  await prisma_default.gifts.create({
    data: {
      code,
      amount,
      bot: {
        connect: {
          wid: client.wid
        }
      }
    }
  });
  await client.sendText(
    message.from,
    `Gift criado com sucesso.

Valor: *R$ ${amount}*

Use: */resgatar ${code}*`
  );
  await client.sendText(message.from, `/resgatar ${code}`);
  notifyAdmin(client, `Admin *${message.author || message.from}* criou um gift

Valor: *R$ ${amount}*
C\xF3digo: *${code}*`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandGift
});
