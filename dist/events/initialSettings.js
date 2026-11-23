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

// src/events/initialSettings.ts
var initialSettings_exports = {};
__export(initialSettings_exports, {
  initialSettings: () => initialSettings
});
module.exports = __toCommonJS(initialSettings_exports);

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

// src/events/initialSettings.ts
async function initialSettings(client, message, requirePayment = true) {
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    },
    include: {
      admins: true
    }
  });
  if (!bot)
    return;
  const userId = message.author || message.from;
  function replyUser(text) {
    if (!bot) {
      client.sendText(message.from, "Error interno, contate o criador do bot!");
      return;
    }
    const admins = bot.admins.map((admin) => admin.wid);
    admins.push(bot.owner);
    if (!admins.includes(userId)) {
      client.sendText(message.from, "Bot n\xE3o configurado, tente novamente mais tarde...");
      return;
    }
    client.sendText(message.from, text);
  }
  if (bot.expireAt < /* @__PURE__ */ new Date() && process.env.BOT_PHONE !== client.wid?.replace(/\D/g, "")) {
    replyUser(
      `*Bot expirado*

*Data d\xE1 expira\xE7\xE3o:* ${bot.expireAt.toLocaleString("pt-BR")}

Use o comando /renovar para renovar o bot`
    );
    return false;
  }
  if (requirePayment && bot.pixType === "auto" && !bot.mercadoPagoToken) {
    replyUser(
      "Token do Mercado Pago n\xE3o configurado\n\nUse o comando /tokenmp para configurar"
    );
    return false;
  }
  if (requirePayment && bot.pixType === "manual" && !bot.pixManualKey) {
    replyUser("Chave pix n\xE3o configurada\n\nUse o comando /pixmanual para configurar");
    return false;
  }
  return true;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  initialSettings
});
