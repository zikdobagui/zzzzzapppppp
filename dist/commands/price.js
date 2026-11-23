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

// src/commands/price.ts
var price_exports = {};
__export(price_exports, {
  commandDefinePrice: () => commandDefinePrice
});
module.exports = __toCommonJS(price_exports);
var import_client2 = require("@prisma/client");

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

// src/commands/price.ts
var prisma2 = new import_client2.PrismaClient();
async function commandDefinePrice(client, message, command) {
  const [name, price] = command.args.join(" ").split(/\|/).map((value) => value.trim());
  if (!name || !price) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o nome e o pre\xE7o do produto. Exemplo: /price Netflix|10"
    );
    return;
  }
  const bot = await prisma2.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (bot === null) {
    client.sendText(message.from, "O bot n\xE3o est\xE1 configurado.");
    return;
  }
  const product = await prisma2.loginsSettings.findUnique({
    where: {
      name
    }
  });
  if (product === null || product.botId !== bot.id) {
    client.sendText(message.from, "O produto n\xE3o est\xE1 cadastrado.");
    return;
  }
  const priceNumber = Number(price.replace(",", "."));
  if (!Number.isFinite(priceNumber) || priceNumber <= 0 || Math.abs(priceNumber * 100 - Math.round(priceNumber * 100)) > 1e-6) {
    client.sendText(message.from, "O pre\xE7o precisa ser maior que zero e ter no m\xE1ximo duas casas decimais.");
    return;
  }
  await prisma2.loginsSettings.update({
    where: {
      name
    },
    data: {
      price: priceNumber
    }
  });
  await client.sendText(
    message.from,
    `O pre\xE7o do produto ${name} foi alterado para R$ ${priceNumber.toFixed(2)}.`
  );
  notifyAdmin(client, `Admin *${message.author || message.from}* alterou o pre\xE7o do produto *${name}* para *R$ ${priceNumber.toFixed(2)}*.`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandDefinePrice
});
