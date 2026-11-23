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
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/buttons/telegramWallet.ts
var telegramWallet_exports = {};
__export(telegramWallet_exports, {
  responseTelegramLogin: () => responseTelegramLogin,
  showTelegramLogins: () => showTelegramLogins,
  tryTelegramPix: () => tryTelegramPix,
  walletStatus: () => walletStatus
});
module.exports = __toCommonJS(telegramWallet_exports);
var import_node_crypto = require("crypto");

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
  const key2 = (options.catalogo ? process.env.WHATSAPP_CATALOG_API_KEY : process.env.WHATSAPP_API_KEY)?.trim();
  const base = process.env.TELEGRAM_BASE_URL?.trim();
  if (!key2 || !base)
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
      headers: { Authorization: `Bearer ${key2}`, "Content-Type": "application/json" },
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
var getTelegramCatalog = () => telegramApi("/api/whatsapp/v1/produtos", { catalogo: true });

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

// src/services/telegramWallet.ts
async function getWalletOperation(phone, id) {
  if (!/^[a-f0-9]{64}$/.test(id))
    throw new TelegramApiError(400);
  return telegramApi(`/api/whatsapp/v1/clientes/${phone}/operacoes/${id}`);
}
async function runWalletOperation(phone, id, kind, payload) {
  try {
    return await telegramApi(`/api/whatsapp/v1/clientes/${phone}/${kind}`, { body: { ...payload, operacao: id } });
  } catch (error) {
    if (!(error instanceof TelegramApiError) || !error.uncertain)
      throw error;
    try {
      return await getWalletOperation(phone, id);
    } catch {
      throw new TelegramApiError(0, true);
    }
  }
}

// src/buttons/telegramWallet.ts
var quotes = /* @__PURE__ */ new Map();
var busy = /* @__PURE__ */ new Set();
var key = (client, sender, id) => `${client.wid}:${sender}:${id.split("_").pop()}`;
var money = (v) => typeof v === "number" && Number.isFinite(v) ? `R$ ${v.toFixed(2)}` : "indispon\xEDvel";
var safe = (v) => String(v ?? "").slice(0, 1500);
var operationId = (client, phone, id, kind) => (0, import_node_crypto.createHash)("sha256").update(JSON.stringify([client.wid, phone, id, kind])).digest("hex");
async function walletActive(client, sender) {
  const summary = await loadTelegramSummary(client.wid, sender);
  if (summary.state === "unavailable")
    throw new TelegramApiError(503);
  return summary.state === "linked" ? summary : null;
}
async function failure(client, to, error, id) {
  const e = error instanceof TelegramApiError ? error : new TelegramApiError(502);
  const text = e.status === 404 || e.reason === "NOT_CONFIGURED" ? "O servidor Telegram precisa ser atualizado para permitir compras e recargas com o saldo compartilhado." : e.uncertain ? `N\xE3o foi poss\xEDvel confirmar a opera\xE7\xE3o. N\xE3o fa\xE7a outra compra ou recarga agora. Consulte /operacaotelegram ${id} ou contate o suporte.` : e.status === 402 ? "Saldo insuficiente na sua conta Telegram." : e.status === 409 ? "Opera\xE7\xE3o pendente ou dados alterados. Consulte seu hist\xF3rico e atualize a lista antes de continuar." : "O servi\xE7o do saldo compartilhado est\xE1 indispon\xEDvel. Tente novamente mais tarde. Nenhum saldo local ser\xE1 usado.";
  await client.sendText(to, text);
}
async function operationResult(client, to, data) {
  if (data?.status !== "DONE") {
    const rejected = data?.status === "REJECTED";
    await client.sendText(to, rejected ? data.erro_status === 402 ? "Saldo insuficiente na sua conta Telegram." : "Opera\xE7\xE3o recusada. Atualize a lista ou confira o valor da recarga." : `Opera\xE7\xE3o em an\xE1lise. N\xE3o fa\xE7a outra compra ou recarga agora. Consulte /operacaotelegram ${safe(data?.operacao)}`);
    return;
  }
  const result = data.resultado;
  if (Array.isArray(result?.entregues)) {
    for (const item of result.entregues) {
      await client.sendText(to, `*\u2705 COMPRA REALIZADA*
Produto: ${safe(item.nome)}
Valor: ${money(item.valor)}

Usu\xE1rio/acesso: ${safe(item.email)}
Senha/c\xF3digo: ${safe(item.senha)}
${safe(item.descricao)}`);
    }
    await client.sendText(to, `${result.entregues.length ? "Compra registrada no mesmo cadastro do Telegram." : "Nenhum produto entregue. Consulte o saldo e o hist\xF3rico antes de tentar novamente."}
*Seu saldo:* ${money(result.saldo)}`);
  } else if (typeof result?.copia === "string" && result.id_pag != null) {
    await client.sendText(to, `*\u{1F4B8} PIX \u2014 SALDO COMPARTILHADO*
Valor da recarga: ${money(result.valor)}
Total a pagar: ${money(result.total)}

${result.copia}

Ap\xF3s aprova\xE7\xE3o, o cr\xE9dito entra no mesmo saldo do Telegram e WhatsApp.
Consultar: /statuspix ${safe(result.id_pag)}`);
  } else
    throw new TelegramApiError(502);
}
async function showTelegramLogins(client, data, offset = 0) {
  if (!telegramEnabled(client.wid))
    return false;
  if (data.chatId !== data.sender) {
    await client.sendText(data.chatId, "Use a conversa privada para comprar.");
    return true;
  }
  try {
    const account = await walletActive(client, data.sender);
    if (!account)
      return false;
    const catalog = await getTelegramCatalog();
    if (!Array.isArray(catalog?.produtos))
      throw new TelegramApiError(502);
    const available = catalog.produtos.filter((p) => typeof p.nome === "string" && typeof p.preco === "number" && Number.isFinite(p.preco) && p.preco > 0 && Number.isInteger(p.estoque) && p.estoque > 0);
    if (!available.length) {
      await client.sendText(data.sender, "Sem produtos em estoque no momento.");
      return true;
    }
    offset = Math.min(Math.max(0, offset), Math.floor((available.length - 1) / 8) * 8);
    const products = /* @__PURE__ */ new Map();
    for (const p of available.slice(offset, offset + 8))
      products.set(`TG \u2022 ${p.nome} \u2014 ${money(p.preco)}`, { name: p.nome, price: p.preco });
    const options = [...products.keys()];
    if (offset + 8 < available.length)
      options.push("TG \u2022 Pr\xF3ximo");
    if (offset > 0)
      options.push("TG \u2022 Anterior");
    const sent = await client.sendPollMessage(data.sender, `*Seu saldo: ${money(account.balance)}*
Conta vinculada ao Telegram. Selecione um produto.`, options, { selectableCount: 1 });
    for (const [id, quote] of quotes)
      if (quote.expires < Date.now())
        quotes.delete(id);
    quotes.set(key(client, data.sender, sent.id), { expires: Date.now() + 15 * 60 * 1e3, offset, products });
  } catch (error) {
    await failure(client, data.sender, error);
  }
  return true;
}
async function responseTelegramLogin(client, data) {
  if (!telegramEnabled(client.wid))
    return false;
  if (data.chatId !== data.sender)
    return true;
  const activeKey = `${client.wid}:${data.sender}`;
  if (busy.has(activeKey)) {
    await client.sendText(data.sender, "Aguarde a opera\xE7\xE3o anterior terminar.");
    return true;
  }
  let id;
  busy.add(activeKey);
  try {
    if (!await walletActive(client, data.sender))
      return false;
    const quote = quotes.get(key(client, data.sender, data.msgId.id));
    if (!quote || quote.expires < Date.now()) {
      await showTelegramLogins(client, data);
      return true;
    }
    const choice = data.selected?.added || "";
    if (choice === "TG \u2022 Pr\xF3ximo" || choice === "TG \u2022 Anterior") {
      await showTelegramLogins(client, data, quote.offset + (choice === "TG \u2022 Pr\xF3ximo" ? 8 : -8));
      return true;
    }
    const product = quote.products.get(choice);
    if (!product)
      return true;
    const phone = telegramPhone(data.sender);
    id = operationId(client, phone, data.msgId.id, "comprar");
    const result = await runWalletOperation(phone, id, "comprar", { produto: product.name, preco: product.price });
    await operationResult(client, data.sender, result);
  } catch (error) {
    await failure(client, data.sender, error, id);
  } finally {
    busy.delete(activeKey);
  }
  return true;
}
async function tryTelegramPix(client, message, command) {
  if (!telegramEnabled(client.wid))
    return false;
  let id;
  try {
    if (!await walletActive(client, message.from))
      return false;
    const amount = Number(command.args[0]?.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(?:[.,]\d{1,2})?$/.test(command.args[0] || "")) {
      await client.sendText(message.from, "Informe o valor. Exemplo: /pix 10");
      return true;
    }
    if (!message.id)
      throw new TelegramApiError(400);
    const phone = telegramPhone(message.from);
    id = operationId(client, phone, message.id, "pix");
    const result = await runWalletOperation(phone, id, "pix", { valor: amount });
    await operationResult(client, message.from, result);
  } catch (error) {
    await failure(client, message.from, error, id);
  }
  return true;
}
async function walletStatus(client, from, kind, id) {
  try {
    const phone = telegramPhone(from);
    if (kind === "/operacaotelegram")
      await operationResult(client, from, await getWalletOperation(phone, id));
    else {
      if (!id || id.length > 200)
        throw new TelegramApiError(400);
      const result = await telegramApi(`/api/whatsapp/v1/clientes/${phone}/pix/${encodeURIComponent(id)}/status`);
      await client.sendText(from, `${result.pago ? "\u2705 Pagamento aprovado." : "\u23F3 Pagamento ainda n\xE3o confirmado."}
*Seu saldo:* ${money(result.saldo)}`);
    }
  } catch (error) {
    await failure(client, from, error, id);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  responseTelegramLogin,
  showTelegramLogins,
  tryTelegramPix,
  walletStatus
});
