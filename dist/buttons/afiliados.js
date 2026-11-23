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

// src/buttons/afiliados.ts
var afiliados_exports = {};
__export(afiliados_exports, {
  affiliateds: () => affiliateds
});
module.exports = __toCommonJS(afiliados_exports);

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

// src/buttons/afiliados.ts
async function affiliateds(client, data) {
  const user = await prisma_default.user.findFirst({
    where: {
      wid: data.sender,
      bot: {
        wid: client.wid
      }
    },
    include: {
      affiliateds: true,
      loginsHistory: true
    }
  });
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (user === null) {
    client.sendText(data.chatId, "Voc\xEA n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  const phone = user.wid.replace(/\D/g, "");
  const phoneBot = client.wid?.replace(/\D/g, "");
  const affiliateds2 = user.affiliateds.reduce(
    (acc, item) => {
      const phone2 = item.wid.replace(/\D/g, "");
      const text2 = `*@${phone2}*
`;
      acc.text += text2;
      acc.list.push(item.wid);
      return acc;
    },
    { text: "", list: [] }
  );
  const linkAffiliated = `https://wa.me/${phoneBot}?text=${encodeURIComponent(
    `/afiliado ${phone}`
  )}`;
  const text = `*\u{1F464} Sistema de Afiliados:*

${bot?.textAffiliateds}

*\u{1F517} Link:* ${linkAffiliated}

*Usu\xE1rios Afiliados:*
` + affiliateds2.text;
  await client.sendText(data.chatId, text, {
    linkPreview: false
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  affiliateds
});
