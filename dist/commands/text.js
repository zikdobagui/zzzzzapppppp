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

// src/commands/text.ts
var text_exports = {};
__export(text_exports, {
  commandDefineText: () => commandDefineText
});
module.exports = __toCommonJS(text_exports);

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

// src/commands/text.ts
var menus = {
  inicial: "textMenu",
  pix: "textPix",
  suporte: "textSupport",
  login: "textLogin",
  pixmanual: "textPixManual",
  afiliados: "textAffiliateds"
};
async function commandDefineText(client, message, command) {
  const [menu, ...textArg] = command.args.join(" ").split(/\n/);
  const text = textArg.join("\n");
  if (!menu || !text) {
    const str = `Voc\xEA precisa informar o nome do menu e o texto.

Menus dispon\xEDveis:
\`\`\`${Object.keys(menus).join("\n")}\`\`\`

Modo de uso: /text [NOME DO MENU]
[TEXTO DO MENU]

Exemplo: /text inicial
Ol\xE1, seja bem vindo ao nosso bot!`;
    client.sendText(message.from, str);
    return;
  }
  const menuName = menu.toLowerCase();
  const menuKey = menus[menuName];
  if (!menuKey) {
    client.sendText(
      message.from,
      `O menu *${menuName}* n\xE3o est\xE1 cadastrado. Os menus cadastrados s\xE3o: ${Object.keys(
        menus
      ).join(", ")}`
    );
    return;
  }
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      [menuKey]: text
    }
  });
  await client.sendText(message.from, `O menu *${menuName}* foi atualizado com sucesso.`);
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} atualizou o texto do menu *${menuName}*
Texto:
${text}`
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandDefineText
});
