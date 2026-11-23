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

// src/commands/addusers.ts
var addusers_exports = {};
__export(addusers_exports, {
  commandAddUsers: () => commandAddUsers
});
module.exports = __toCommonJS(addusers_exports);

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

// src/commands/addusers.ts
async function commandAddUsers(client, message, command) {
  const numbers = command.args.join(" ").split(/\r?\n/).map((number) => number.replace(/\D/g, "")).filter(Boolean);
  if (numbers.length === 0) {
    await client.sendText(
      message.from,
      "Voc\xEA precisa informar os n\xFAmeros. Exemplo: /addusers 5511999999999\n5511888888888\n5511777777777"
    );
    return;
  }
  let count = 0;
  for (const number of numbers) {
    try {
      await prisma_default.user.create({
        data: {
          wid: number,
          bot: {
            connect: {
              wid: client.wid
            }
          }
        }
      });
      count++;
    } catch (error) {
      console.log(error.message);
    }
  }
  await client.sendText(
    message.from,
    `Foram adicionados ${count} usu\xE1rios com sucesso, e ${numbers.length - count} falharam.`
  );
  notifyAdmin(
    client,
    `O admin ${message.author || message.from} adicionou ${count} usu\xE1rios com sucesso, e ${numbers.length - count} falharam.`
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandAddUsers
});
