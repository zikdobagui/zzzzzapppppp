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

// src/commands/textLogin.ts
var textLogin_exports = {};
__export(textLogin_exports, {
  commandDefineTextLogin: () => commandDefineTextLogin
});
module.exports = __toCommonJS(textLogin_exports);

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

// src/commands/textLogin.ts
async function commandDefineTextLogin(client, message, command) {
  const [loginName, ...textArg] = command.args.join(" ").split(/\n/);
  const text = textArg.join("\n");
  if (!loginName || !text) {
    const str = "Voc\xEA precisa informar o nome do login e o texto.\n\nModo de uso: /logintext [NOME DO LOGIN]\n[TEXTO]\n\nExemplo: /logintext Netflix\nBela compra, obrigado!";
    client.sendText(message.from, str);
    return;
  }
  const login = await prisma_default.loginsSettings.findFirst({
    where: {
      name: loginName,
      bot: {
        wid: client.wid
      }
    }
  });
  if (!login) {
    client.sendText(message.from, "Login n\xE3o encontrado.");
    return;
  }
  await prisma_default.loginsSettings.update({
    where: {
      id: login.id,
      bot: {
        wid: client.wid
      }
    },
    data: {
      text
    }
  });
  await client.sendText(message.from, `O texto do login *${login.name}* foi atualizado com sucesso.`);
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} atualizou o texto do login *${login.name}*
Texto:
${text}`
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandDefineTextLogin
});
