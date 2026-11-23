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

// src/commands/spam.ts
var spam_exports = {};
__export(spam_exports, {
  commandSpam: () => commandSpam
});
module.exports = __toCommonJS(spam_exports);

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

// src/commands/spam.ts
var import_fs = require("fs");
async function commandSpam(client, message, command) {
  const text = command.args.join(" ");
  if (!text) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o texto que deseja enviar. Use: /spam texto"
    );
    return;
  }
  const users = await prisma_default.user.findMany({
    where: {
      bot: {
        wid: client.wid
      }
    },
    select: {
      wid: true
    }
  });
  if (users.length === 0) {
    client.sendText(message.from, "Nenhum usu\xE1rio encontrado.");
    return;
  }
  await client.sendText(message.from, `Enviando mensagem para ${users.length} usu\xE1rios...`);
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} est\xE1 fazendo spam para ${users.length} usu\xE1rios...`
  );
  let filename;
  if (message.type === "image") {
    const response = await client.downloadMedia(message);
    const base64Data = response.replace(/data:image\/.+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    filename = `./assets/${Date.now()}.jpg`;
    (0, import_fs.writeFileSync)(filename, buffer);
  }
  let count = 0;
  for (const user of users) {
    try {
      if (filename) {
        await client.sendImage(user.wid, filename, "image.jpg", text);
      } else {
        await client.sendText(user.wid, text);
      }
      count++;
    } catch (error) {
      console.error(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1e4));
  }
  if (filename)
    (0, import_fs.rmSync)(filename);
  client.sendText(message.from, `Mensagem enviada para ${count} usu\xE1rios com sucesso.`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandSpam
});
