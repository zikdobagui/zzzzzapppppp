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

// src/services/telegramApi.ts
var telegramApi_exports = {};
__export(telegramApi_exports, {
  TelegramApiError: () => TelegramApiError,
  getTelegramCatalog: () => getTelegramCatalog,
  getTelegramClient: () => getTelegramClient,
  getTelegramHistory: () => getTelegramHistory,
  linkTelegram: () => linkTelegram,
  telegramApi: () => telegramApi,
  telegramEnabled: () => telegramEnabled,
  telegramPhone: () => telegramPhone
});
module.exports = __toCommonJS(telegramApi_exports);
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
var getTelegramHistory = (phone) => telegramApi(`/api/whatsapp/v1/clientes/${phone}/historico`);
var getTelegramCatalog = () => telegramApi("/api/whatsapp/v1/produtos", { catalogo: true });
async function linkTelegram(phone, codigo) {
  try {
    const result = await telegramApi("/api/whatsapp/v1/vincular", { body: { codigo, whatsapp: phone } });
    if (result?.vinculado !== true)
      throw new TelegramApiError(502, true);
    return result;
  } catch (error) {
    if (!(error instanceof TelegramApiError) || !error.uncertain)
      throw error;
    try {
      return await getTelegramClient(phone);
    } catch {
      throw new TelegramApiError(0, true);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TelegramApiError,
  getTelegramCatalog,
  getTelegramClient,
  getTelegramHistory,
  linkTelegram,
  telegramApi,
  telegramEnabled,
  telegramPhone
});
