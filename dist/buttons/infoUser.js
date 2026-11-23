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

// src/buttons/infoUser.ts
var infoUser_exports = {};
__export(infoUser_exports, {
  infoUser: () => infoUser
});
module.exports = __toCommonJS(infoUser_exports);

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
function accountSummaryText(local, remote) {
  const localText = `*\u25C6 Saldo para compras no WhatsApp:* R$ ${local.balance.toFixed(2)}
*\u25C6 Compras no WhatsApp:* ${local.purchases}
`;
  if (remote.state === "linked") {
    return `*\u25C6 Conta Telegram vinculada*
*\u25C6 Seu saldo:* R$ ${remote.balance.toFixed(2)}
*\u25C6 Compras realizadas:* ${remote.purchases}
`;
  }
  if (remote.state === "unavailable")
    return "*\u25C6 Saldo e compras temporariamente indispon\xEDveis*\n";
  return localText;
}

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

// src/buttons/infoUser.ts
async function infoUser(client, data) {
  if (data.chatId !== data.sender)
    return;
  const user = await prisma_default.user.findFirst({
    where: {
      wid: data.sender,
      bot: {
        wid: client.wid
      }
    },
    include: {
      _count: {
        select: {
          loginsHistory: true
        }
      },
      gifts: true
    }
  });
  if (user === null) {
    client.sendText(data.chatId, "Voc\xEA n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  const phone = user.wid.replace(/\D/g, "");
  const giftTotal = user.gifts.reduce((acc, { amount }) => acc + amount, 0);
  const telegram = await loadTelegramSummary(client.wid, data.sender);
  const summary = accountSummaryText({ balance: user.balance, purchases: user._count.loginsHistory }, telegram);
  const text = `*\u{1F464} Informa\xE7\xF5es do usu\xE1rio:*

*\u{1F4F1} N\xFAmero:* ${phone}
` + summary + (telegram.state === "unlinked" ? `*\u{1F381} Gifts Resgatados:* R$ ${giftTotal.toFixed(2)}` : "");
  const options = ["\u{1FAC2} Afiliados", "\u{1F9FE} Hist\xF3rico de Logins"];
  if (telegram.state === "linked")
    options.push("\u{1F9FE} Hist\xF3rico Telegram");
  await client.sendPollMessage(data.chatId, text, options, {
    selectableCount: 1
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  infoUser
});
