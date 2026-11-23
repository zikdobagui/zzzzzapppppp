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

// src/commands/redeem.ts
var redeem_exports = {};
__export(redeem_exports, {
  commandRedeem: () => commandRedeem
});
module.exports = __toCommonJS(redeem_exports);

// src/services/telegramApi.ts
var TelegramApiError = class extends Error {
  constructor(status, uncertain = false, reason) {
    super(`Falha na integra\xE7\xE3o Telegram (${status}).`);
    this.status = status;
    this.uncertain = uncertain;
    this.reason = reason;
  }
};
function telegramEnabled(botWid) {
  const phone = process.env.TELEGRAM_BOT_PHONE?.trim() || process.env.BOT_PHONE?.trim();
  return process.env.TELEGRAM_ENABLED === "true" && Boolean(phone) && botWid === `${phone}@c.us`;
}
function telegramPhone(address) {
  const match = /^([1-9]\d{9,14})(?::\d+)?@(?:c\.us|s\.whatsapp\.net)$/.exec(address);
  if (!match)
    throw new TelegramApiError(400);
  return match[1];
}
async function telegramApi(path, options = {}) {
  const key = (options.catalogo ? process.env.WHATSAPP_CATALOG_API_KEY : process.env.WHATSAPP_API_KEY)?.trim();
  const base = process.env.TELEGRAM_BASE_URL?.trim();
  if (!key || !base)
    throw new TelegramApiError(503, false, "NOT_CONFIGURED");
  let url;
  try {
    url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
      throw new Error();
    url = new URL(path, url);
  } catch {
    throw new TelegramApiError(503);
  }
  let response;
  try {
    response = await fetch(url, {
      method: options.body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : void 0,
      signal: AbortSignal.timeout(15e3),
      redirect: "error"
    });
  } catch {
    throw new TelegramApiError(0, Boolean(options.body));
  }
  if (!response.ok) {
    if (response.status === 503) {
      let data;
      try {
        data = await response.json();
      } catch {
      }
      const reason = typeof data?.erro === "string" ? data.erro.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";
      if (reason === "integracao nao configurada" || reason === "operacoes compartilhadas nao configuradas")
        throw new TelegramApiError(503, false, "NOT_CONFIGURED");
    }
    throw new TelegramApiError(response.status, Boolean(options.body) && response.status >= 500);
  }
  try {
    return await response.json();
  } catch {
    throw new TelegramApiError(502, Boolean(options.body));
  }
}
var getTelegramClient = (phone) => telegramApi(`/api/whatsapp/v1/clientes/${phone}`);

// src/services/accountSummary.ts
async function loadTelegramSummary(botWid, sender) {
  if (!telegramEnabled(botWid))
    return { state: "unlinked" };
  try {
    const user = await getTelegramClient(telegramPhone(sender));
    if (typeof user?.saldo !== "number" || !Number.isFinite(user.saldo) || !Number.isInteger(user.total_compras) || user.total_compras < 0)
      throw new TelegramApiError(502);
    return { state: "linked", balance: user.saldo, purchases: user.total_compras };
  } catch (error) {
    if (error instanceof TelegramApiError && error.status === 404)
      return { state: "unlinked" };
    return { state: "unavailable" };
  }
}

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

// src/commands/redeem.ts
async function commandRedeem(client, message, command) {
  const account = await loadTelegramSummary(client.wid, message.from);
  if (account.state !== "unlinked") {
    await client.sendText(message.from, account.state === "linked" ? "Sua conta usa o saldo \xFAnico do Telegram. Resgate o gift no Telegram/site para que o cr\xE9dito apare\xE7a tamb\xE9m aqui." : "N\xE3o foi poss\xEDvel consultar o saldo compartilhado. Tente novamente mais tarde.");
    return;
  }
  const [code] = command.args;
  if (!code) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o c\xF3digo do gift.\n\nExemplo: /resgatar ABC123"
    );
    return;
  }
  const gift = await prisma_default.gifts.findUnique({
    where: {
      code,
      bot: {
        wid: client.wid
      }
    }
  });
  if (gift === null) {
    client.sendText(message.from, "Este gift n\xE3o existe.");
    return;
  }
  if (gift.redeemed) {
    client.sendText(message.from, "Este gift j\xE1 foi resgatado.");
    return;
  }
  let user = await prisma_default.user.findFirst({
    where: {
      wid: message.author || message.from,
      bot: {
        wid: client.wid
      }
    }
  });
  if (user === null) {
    client.sendText(message.from, "Voc\xEA n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  user = await prisma_default.user.update({
    where: {
      id: user.id
    },
    data: {
      balance: {
        increment: gift.amount
      }
    }
  });
  await prisma_default.gifts.update({
    where: {
      id: gift.id
    },
    data: {
      redeemed: true,
      redeemedAt: /* @__PURE__ */ new Date()
    }
  });
  await client.sendImage(
    message.from,
    "./assets/gift.jpeg",
    "gift.jpeg",
    `Gift resgatado com sucesso.

Valor: *R$ ${gift.amount}*
Saldo atual: *R$ ${user.balance}*`
  );
  notifyAdmin(
    client,
    `Usu\xE1rio ${message.author || message.from} resgatou um gift.

Valor: *R$ ${gift.amount}*
Saldo atual: *R$ ${user.balance}*`
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandRedeem
});
