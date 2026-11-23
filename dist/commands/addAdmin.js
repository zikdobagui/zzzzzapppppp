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

// src/commands/addAdmin.ts
var addAdmin_exports = {};
__export(addAdmin_exports, {
  commandAddAdmin: () => commandAddAdmin
});
module.exports = __toCommonJS(addAdmin_exports);

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

// src/commands/addAdmin.ts
async function commandAddAdmin(client, message, command) {
  const number = command.args.join(" ").replace(/\D/g, "");
  if (!number) {
    client.sendText(
      message.from,
      "N\xFAmero invalido ou n\xE3o informado. Use: /addadmin 5511999999999"
    );
    return;
  }
  const admin = await prisma_default.admins.findFirst({
    where: {
      wid: `${number}@c.us`,
      bot: {
        wid: client.wid
      }
    }
  });
  if (admin) {
    client.sendText(message.from, `O n\xFAmero *${number}* j\xE1 \xE9 um administrador.`);
    return;
  }
  await prisma_default.admins.create({
    data: {
      wid: `${number}@c.us`,
      bot: {
        connect: {
          wid: client.wid
        }
      }
    }
  });
  client.sendText(message.from, `O n\xFAmero *${number}* foi adicionado como administrador.`);
  notifyAdmin(client, `O n\xFAmero *${number}* foi adicionado como administrador.`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandAddAdmin
});
