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

// src/commands/fakeNotify.ts
var fakeNotify_exports = {};
__export(fakeNotify_exports, {
  commandFakeNotify: () => commandFakeNotify
});
module.exports = __toCommonJS(fakeNotify_exports);

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

// src/commands/fakeNotify.ts
async function commandFakeNotify(client, message) {
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (!bot) {
    throw new Error("Bot not found");
  }
  const fakeNotify = !bot.fakeNotify;
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      fakeNotify
    }
  });
  await client.sendText(
    message.from,
    `O modo de *Notifica\xE7\xF5es Fake* foi ${fakeNotify ? "ativado" : "desativado"} com sucesso.`
  );
  notifyAdmin(
    client,
    `O modo de *Notifica\xE7\xF5es Fake* foi ${fakeNotify ? "ativado" : "desativado"} por *${message.author || message.from}*`
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandFakeNotify
});
