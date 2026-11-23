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

// src/commands/priceWeek.ts
var priceWeek_exports = {};
__export(priceWeek_exports, {
  commandPriceWeek: () => commandPriceWeek
});
module.exports = __toCommonJS(priceWeek_exports);

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

// src/commands/priceWeek.ts
async function commandPriceWeek(client, message, command) {
  const _amount = command.args.join(" ");
  const amount = Number(_amount);
  if (client.wid?.replace(/\D/g, "") !== process.env.BOT_PHONE) {
    client.sendText(message.from, "Bot n\xE3o \xE9 o principal.");
    return;
  }
  if (!amount) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o valor do aluguel semanal dos bots.\n\nExemplo: /precosemana 10"
    );
    return;
  }
  await prisma_default.botMaster.update({
    where: {
      wid: client.wid
    },
    data: {
      priceWeek: amount
    }
  });
  await client.sendText(
    message.from,
    `Valor do aluguel semanal atualizado com sucesso

Valor: *${amount}*`
  );
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} atualizou o valor do aluguel semanal dos bots

Valor: *${amount}*`
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandPriceWeek
});
