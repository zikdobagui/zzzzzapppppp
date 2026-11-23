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

// src/commands/notifySales.ts
var notifySales_exports = {};
__export(notifySales_exports, {
  commandDefineNotifySales: () => commandDefineNotifySales,
  notifySales: () => notifySales
});
module.exports = __toCommonJS(notifySales_exports);
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

// src/commands/notifySales.ts
var import_fs = require("fs");
var prisma2 = new import_client2.PrismaClient();
async function commandDefineNotifySales(client, message, command) {
  const widNotify = command.args.join(" ");
  if (!widNotify) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o ID do grupo, para pegar o ID do grupo, va no chat do grupo e execute o comando /id.\n\nExemplo: /notificacoes *99999999999@g.us* ou *0* para desativar as notifica\xE7\xF5es."
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
  if (widNotify === "0") {
    await prisma2.bot.update({
      where: {
        wid: client.wid
      },
      data: {
        notifySalesWid: ""
      }
    });
    client.sendText(message.from, "Notifica\xE7\xF5es desativadas.");
    return;
  }
  if (!widNotify.endsWith("@g.us")) {
    client.sendText(message.from, "O ID do grupo precisa terminar com @g.us");
    return;
  }
  await prisma2.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      notifySalesWid: widNotify
    }
  });
  await client.sendText(message.from, `Notifica\xE7\xF5es ativadas para o grupo ${widNotify}.`);
  await notifyAdmin(client, `O Admin ${message.author || message.from} ativou as notifica\xE7\xF5es para o grupo ${widNotify}.`);
}
async function notifySales(client, login, user) {
  const bot = await prisma2.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (!bot || !bot.notifySalesWid)
    return;
  const text = `*\u{1F4F1} USU\xC1RIO COMPROU UM LOGIN \u{1F4F1}*

*\u269C\uFE0F ${login.name} \u269C\uFE0F*
*\u{1F464} Usuario:* @${user.replace(/\D/g, "")}
*\u{1F4B0} Valor:* R$ ${login.price}

VENHA ADQUIRIR OS MELHORES LOGINS DO MERCADO!

ATENDIMENTO 100% AUTOM\xC1TICO!

Este \xE9 o n\xFAmero do BOT, mande qualquer mensagem!
wa.me/${bot.wid.replace(/\D/g, "")}`;
  if (login.image) {
    const filename = `./assets/${Date.now()}.png`;
    (0, import_fs.writeFileSync)(filename, login.image);
    await client.sendImage(bot.notifySalesWid, filename, "image.png", text);
    (0, import_fs.rmSync)(filename);
  } else {
    await client.sendText(bot.notifySalesWid, text, { mentionedList: [user] });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandDefineNotifySales,
  notifySales
});
