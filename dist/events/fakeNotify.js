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

// src/events/fakeNotify.ts
var fakeNotify_exports = {};
__export(fakeNotify_exports, {
  fakeNotify: () => fakeNotify
});
module.exports = __toCommonJS(fakeNotify_exports);

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

// src/commands/notifySales.ts
var import_client2 = require("@prisma/client");
var import_fs = require("fs");
var prisma2 = new import_client2.PrismaClient();
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

// src/helpers/util.ts
function generatePhone() {
  const ddds = [
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    21,
    22,
    24,
    27,
    28,
    31,
    32,
    33,
    34,
    35,
    37,
    38,
    41,
    42,
    43,
    44,
    45,
    46,
    47,
    48,
    49,
    51,
    53,
    54,
    55,
    61,
    62,
    63,
    64,
    65,
    66,
    67,
    68,
    69,
    71,
    73,
    74,
    75,
    77,
    79,
    81,
    82,
    83,
    84,
    85,
    86,
    87,
    88,
    89,
    91,
    92,
    93,
    94,
    95,
    96,
    97,
    98,
    99
  ];
  const ddd = ddds[random(0, ddds.length - 1)];
  const phone = random(1e7, 99999999).toString();
  return `55${ddd}9${phone}`;
}
function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/events/fakeNotify.ts
async function fakeNotify(client) {
  setInterval(async () => {
    await sleep(random(1e3 * 60, 1e3 * 60 * 5));
    const bot = await prisma_default.bot.findUnique({
      where: {
        wid: client.wid
      },
      select: {
        fakeNotify: true,
        loginsSettings: true,
        logins: true
      }
    });
    if (!bot) {
      throw new Error("Bot not found");
    }
    if (!bot.fakeNotify)
      return;
    const logins = bot.loginsSettings.filter(
      (login2) => bot.logins.filter(({ name }) => name === login2.name)
    );
    if (logins.length === 0)
      return;
    const login = logins[random(0, logins.length - 1)];
    notifySales(client, login, generatePhone());
  }, 1e3 * 60 * 5);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  fakeNotify
});
