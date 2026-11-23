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

// src/commands/imageLogin.ts
var imageLogin_exports = {};
__export(imageLogin_exports, {
  commandImageLogin: () => commandImageLogin
});
module.exports = __toCommonJS(imageLogin_exports);

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

// src/commands/imageLogin.ts
async function commandImageLogin(client, message, command) {
  const args = command.args.join(" ");
  if (message.type !== "image") {
    await client.sendText(
      message.from,
      "Use /loginimg [NOME DO LOGIN] na legenda de uma imagem!"
    );
    return;
  }
  if (!args) {
    await client.sendText(
      message.from,
      "Use /loginimg [NOME DO LOGIN] na legenda de uma imagem!"
    );
    return;
  }
  const login = await prisma_default.loginsSettings.findFirst({
    where: {
      name: args,
      bot: {
        wid: client.wid
      }
    }
  });
  if (!login) {
    await client.sendText(message.from, "Login n\xE3o encontrado!");
    return;
  }
  const response = await client.downloadMedia(message);
  const base64Data = response.replace(/data:image\/.+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  await prisma_default.loginsSettings.update({
    where: {
      id: login.id,
      bot: {
        wid: client.wid
      }
    },
    data: {
      image: buffer
    }
  });
  await client.sendText(message.from, `Image do login *${login.name}* atualizada com sucesso!`);
  notifyAdmin(client, `Admin ${message.author || message.from} atualizou a imagem do login *${login.name}*`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandImageLogin
});
