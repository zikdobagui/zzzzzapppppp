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

// src/commands/removeStock.ts
var removeStock_exports = {};
__export(removeStock_exports, {
  commandRemoveStock: () => commandRemoveStock
});
module.exports = __toCommonJS(removeStock_exports);
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

// src/commands/removeStock.ts
var prisma2 = new import_client2.PrismaClient();
async function commandRemoveStock(client, message, command) {
  const [name] = command.args;
  if (!name) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o nome do produto que deseja remover. Exemplo: /removerstock Netflix",
      {
        quotedMsg: message.id
      }
    );
    return;
  }
  const { count } = await prisma2.logins.deleteMany({
    where: {
      bot: {
        wid: client.wid
      },
      name
    }
  });
  if (count === 0) {
    client.sendText(message.from, "O produto n\xE3o est\xE1 cadastrado.", {
      quotedMsg: message.id
    });
    return;
  }
  await client.sendText(message.from, `Foram removidos ${count} logins do produto "${name}".`, {
    quotedMsg: message.id
  });
  notifyAdmin(client, `Admin ${message.author || message.from} removeu ${count} logins do produto "${name}".`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandRemoveStock
});
