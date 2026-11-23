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

// src/buttons/logins.ts
var logins_exports = {};
__export(logins_exports, {
  responseBuyLogin: () => responseBuyLogin,
  showLogins: () => showLogins
});
module.exports = __toCommonJS(logins_exports);

// src/buttons/telegramWallet.ts
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

// src/commands/notifySales.ts
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

// src/buttons/logins.ts
var import_client3 = require("@prisma/client");
var import_fs2 = require("fs");

// src/services/stockApi.ts
var StockApiError = class extends Error {
  constructor(code, uncertain = false) {
    super(`Falha na API de estoque (${code}).`);
    this.code = code;
    this.uncertain = uncertain;
  }
};
function stockApiEnabled() {
  return process.env.STOCK_API_ENABLED === "true";
}
function retailPrice(cost, override) {
  const margin = Number(process.env.STOCK_API_MARGIN_PERCENT || "30");
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(margin) || margin < 0) {
    throw new StockApiError("INVALID_PRICE");
  }
  const price = override && override > 0 ? override : Math.round(cost * (1 + margin / 100) * 100) / 100;
  if (!Number.isFinite(price) || price < cost)
    throw new StockApiError("PRICE_BELOW_COST");
  return price;
}
async function request(endpoint, body) {
  const key2 = process.env.STOCK_API_KEY?.trim();
  if (!key2)
    throw new StockApiError("MISSING_KEY");
  const base = new URL(process.env.STOCK_API_URL || "https://vendasdoramon.squareweb.app");
  if (base.protocol !== "https:" || base.username || base.password)
    throw new StockApiError("INVALID_URL");
  let response;
  try {
    response = await fetch(new URL(endpoint, base), {
      method: body ? "POST" : "GET",
      headers: { "X-Stock-Key": key2, ...body ? { "Content-Type": "application/json" } : {} },
      body: body ? JSON.stringify(body) : void 0,
      signal: AbortSignal.timeout(2e4),
      redirect: "error"
    });
  } catch {
    throw new StockApiError("NETWORK", Boolean(body));
  }
  if (!response.ok) {
    const rejected = [400, 401, 402, 403, 404, 422].includes(response.status);
    throw new StockApiError(`HTTP_${response.status}`, Boolean(body) && !rejected);
  }
  try {
    return await response.json();
  } catch {
    throw new StockApiError("INVALID_RESPONSE", Boolean(body));
  }
}
function parseStock(payload) {
  const stock = payload?.stock;
  if (!Array.isArray(stock))
    throw new StockApiError("INVALID_CATALOG");
  return stock.map((entry) => {
    if (!entry || typeof entry.id !== "string" || typeof entry.name !== "string" || !entry.name.trim() || typeof entry.price !== "number" || !Number.isFinite(entry.price) || entry.price <= 0 || !Number.isInteger(entry.stock) || entry.stock < 0) {
      throw new StockApiError("INVALID_PRODUCT");
    }
    const days = Number(entry.duracao);
    return {
      id: entry.id,
      name: entry.name,
      cost: entry.price,
      stock: entry.stock,
      description: typeof entry.descricao === "string" ? entry.descricao : "",
      durationDays: Number.isFinite(days) && days >= 0 ? days : 0
    };
  });
}
async function listStock() {
  return parseStock(await request("/api/stock"));
}
function parseAccess(payload) {
  const access = payload?.access;
  if (!access || typeof access.nome !== "string" || typeof access.email !== "string" || typeof access.senha !== "string" || !access.email && !access.senha || typeof access.valor !== "number" || !Number.isFinite(access.valor) || access.valor < 0) {
    throw new StockApiError("INVALID_ACCESS", true);
  }
  return {
    nome: access.nome,
    valor: access.valor,
    email: access.email,
    senha: access.senha,
    adicional: typeof access.adicional === "string" ? access.adicional : ""
  };
}
async function reserveStock(service, buyerId, saleId) {
  return parseAccess(await request("/api/stock/reserve", { service, buyer_id: buyerId, sale_id: saleId }));
}

// src/services/stockOrders.ts
var import_node_crypto2 = require("crypto");
var PurchaseError = class extends Error {
};
function stockOrderService(db = prisma_default, reserve = reserveStock) {
  async function finish(orderId) {
    return db.$transaction(async (tx) => {
      const order = await tx.stockApiOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status === "COMPLETED")
        return order;
      if (order.status !== "RECEIVED" || !order.accessJson)
        throw new PurchaseError("Pedido ainda n\xE3o confirmado pelo fornecedor.");
      const access = JSON.parse(order.accessJson);
      const claimed = await tx.stockApiOrder.updateMany({ where: { id: orderId, status: "RECEIVED" }, data: { status: "COMPLETED" } });
      if (!claimed.count)
        throw new PurchaseError("Pedido j\xE1 est\xE1 sendo finalizado.");
      const history = await tx.loginsHistory.create({ data: {
        botId: order.botId,
        userId: order.userId,
        loginName: order.serviceName,
        loginPrice: order.price,
        loginUser: access.email,
        loginPassword: access.senha,
        loginAdditional: access.additional || access.adicional || ""
      } });
      return tx.stockApiOrder.update({ where: { id: orderId }, data: { historyId: history.id } });
    });
  }
  async function refund(orderId, manual = false) {
    return db.$transaction(async (tx) => {
      const order = await tx.stockApiOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status === "REFUNDED")
        return order;
      const allowed = manual ? ["REVIEW", "PROCESSING"] : ["REJECTED"];
      if (!allowed.includes(order.status) || order.accessJson)
        throw new PurchaseError("Este pedido n\xE3o pode ser estornado.");
      if (manual && order.status === "PROCESSING" && Date.now() - order.updatedAt.getTime() < 5 * 60 * 1e3) {
        throw new PurchaseError("Aguarde 5 minutos: a reserva ainda pode estar em andamento.");
      }
      const claimed = await tx.stockApiOrder.updateMany({ where: { id: orderId, status: order.status }, data: { status: "REFUNDED" } });
      if (!claimed.count)
        throw new PurchaseError("O pedido mudou de estado. Consulte novamente.");
      await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: order.price } } });
      return tx.stockApiOrder.findUniqueOrThrow({ where: { id: orderId } });
    });
  }
  async function buy(input) {
    if (!Number.isFinite(input.price) || input.price <= 0 || input.price < input.cost)
      throw new PurchaseError("Pre\xE7o inv\xE1lido. Atualize a lista.");
    const requestKey = (0, import_node_crypto2.createHash)("sha256").update(JSON.stringify([input.botId, input.userId, input.pollId])).digest("hex");
    const existing = await db.stockApiOrder.findUnique({ where: { requestKey } });
    if (existing)
      return existing.status === "RECEIVED" ? finish(existing.id) : existing;
    let order;
    try {
      order = await db.$transaction(async (tx) => {
        const pending = await tx.stockApiOrder.findFirst({ where: { botId: input.botId, userId: input.userId, status: { in: ["PROCESSING", "REVIEW", "RECEIVED", "REJECTED"] } } });
        if (pending)
          throw new PurchaseError(`Voc\xEA possui um pedido pendente: ${pending.id}. Consulte /apipedido ${pending.id}.`);
        const debited = await tx.user.updateMany({ where: { id: input.userId, botId: input.botId, balance: { gte: input.price } }, data: { balance: { decrement: input.price } } });
        if (!debited.count)
          throw new PurchaseError("Voc\xEA n\xE3o tem saldo suficiente.");
        return tx.stockApiOrder.create({ data: { id: `zap-${(0, import_node_crypto2.randomUUID)()}`, requestKey, botId: input.botId, userId: input.userId, serviceName: input.service, price: input.price, cost: input.cost } });
      });
    } catch (error) {
      const duplicate = await db.stockApiOrder.findUnique({ where: { requestKey } });
      if (duplicate)
        return duplicate;
      throw error;
    }
    let access;
    try {
      access = await reserve(input.service, input.buyerWid, order.id);
    } catch (error) {
      const uncertain = !(error instanceof StockApiError) || error.uncertain;
      await db.stockApiOrder.update({ where: { id: order.id }, data: { status: uncertain ? "REVIEW" : "REJECTED", errorCode: error instanceof StockApiError ? error.code : "INTERNAL" } });
      return uncertain ? db.stockApiOrder.findUniqueOrThrow({ where: { id: order.id } }) : refund(order.id);
    }
    await db.stockApiOrder.update({ where: { id: order.id }, data: { status: "RECEIVED", accessJson: JSON.stringify({ ...access, additional: [input.additional, access.adicional].filter(Boolean).join("\n") }) } });
    return finish(order.id);
  }
  return { buy, finish, refund };
}
var stockOrders = stockOrderService();

// src/buttons/apiLogins.ts
var polls = /* @__PURE__ */ new Map();
var limit = 8;
function usesStockApi(client) {
  return stockApiEnabled() && client.db?.name === "Principal";
}
function pollKey(client, sender, id) {
  return `${client.db.id}:${sender}:${id.split("_").pop()}`;
}
async function showApiLogins(client, data, offset = 0) {
  if (!client.db)
    return;
  if (data.chatId.endsWith("@g.us")) {
    await client.sendText(data.chatId, "Abra a conversa privada com o bot para comprar.");
    return;
  }
  try {
    const products = await listStock();
    const available = products.filter((product) => product.stock > 0);
    if (!available.length) {
      await client.sendText(data.chatId, "Sem estoque de logins no momento.");
      return;
    }
    offset = Math.min(Math.max(offset, 0), Math.floor((available.length - 1) / limit) * limit);
    const choices = /* @__PURE__ */ new Map();
    for (const product of available.slice(offset, offset + limit)) {
      const setting = await prisma_default.loginsSettings.findUnique({ where: { name: product.name } });
      if (setting && setting.botId !== client.db.id)
        continue;
      if (!setting)
        await prisma_default.loginsSettings.create({ data: { name: product.name, botId: client.db.id } });
      let price;
      try {
        price = retailPrice(product.cost, setting?.price);
      } catch {
        continue;
      }
      choices.set(`${product.name} - R$ ${price.toFixed(2)} - Estoque: ${product.stock}`, { product, price });
    }
    if (!choices.size) {
      await client.sendText(data.chatId, "Os produtos desta p\xE1gina precisam de ajuste de pre\xE7o. Entre em contato com o suporte.");
      return;
    }
    const user = await prisma_default.user.findFirst({ where: { botId: client.db.id, wid: data.sender } });
    const options = [...choices.keys()];
    if (offset + limit < available.length)
      options.push("Proximo");
    if (offset > 0)
      options.push("Anterior");
    const sent = await client.sendPollMessage(data.chatId, `*Seu saldo: R$ ${(user?.balance || 0).toFixed(2)}*

${client.db.textLogin}

Selecione um produto para comprar.`, options, { selectableCount: 1 });
    for (const [key2, value] of polls)
      if (value.expires < Date.now())
        polls.delete(key2);
    polls.set(pollKey(client, data.sender, sent.id), { expires: Date.now() + 15 * 60 * 1e3, choices, offset });
  } catch {
    await client.sendText(data.chatId, "O cat\xE1logo do fornecedor est\xE1 indispon\xEDvel. Tente novamente em alguns minutos.");
  }
}
async function deliverApiOrder(client, recipient, order) {
  if (order.status === "COMPLETED" && order.accessJson) {
    const access = JSON.parse(order.accessJson);
    await client.sendText(
      recipient,
      `*LOGIN COMPRADO COM SUCESSO*

Pedido: ${order.id}
Produto: ${order.serviceName}
Valor: R$ ${order.price.toFixed(2)}

*Usu\xE1rio/acesso:* ${access.email || "-"}
*Senha/c\xF3digo:* ${access.senha || "-"}
${access.additional || access.adicional || ""}

O acesso tamb\xE9m est\xE1 no seu Hist\xF3rico de Logins.`
    );
  } else if (order.status === "REFUNDED" || order.status === "REJECTED") {
    await client.sendText(recipient, `O fornecedor recusou o pedido ${order.id}.${order.status === "REFUNDED" ? " O valor foi devolvido ao seu saldo." : " Seu estorno est\xE1 pendente; contate o suporte."}`);
  } else {
    await client.sendText(recipient, `Pedido ${order.id} aguardando confirma\xE7\xE3o. O valor est\xE1 reservado no seu saldo. N\xE3o refa\xE7a a compra; consulte /apipedido ${order.id} ou fale com o suporte.`);
  }
}
async function responseApiLogin(client, data) {
  if (!client.db || !data.selected?.added)
    return;
  const selected = data.selected.added;
  const page = polls.get(pollKey(client, data.sender, data.msgId.id));
  if (!page || page.expires < Date.now()) {
    await client.sendText(data.chatId, "Esta lista expirou. Abra Logins novamente para consultar os pre\xE7os atuais.");
    return;
  }
  if (selected === "Proximo" || selected === "Anterior") {
    await showApiLogins(client, data, page.offset + (selected === "Proximo" ? limit : -limit));
    return;
  }
  const quote = page.choices.get(selected);
  if (!quote)
    return;
  const user = await prisma_default.user.findFirst({ where: { botId: client.db.id, wid: data.sender } });
  if (!user) {
    await client.sendText(data.chatId, "Envie uma mensagem ao bot no privado para se cadastrar.");
    return;
  }
  try {
    const current = (await listStock()).find((product) => product.id === quote.product.id);
    if (!current || !current.stock)
      throw new PurchaseError("Este produto ficou sem estoque. Abra Logins novamente.");
    const setting = await prisma_default.loginsSettings.findUnique({ where: { name: current.name } });
    const price = retailPrice(current.cost, setting?.botId === client.db.id ? setting.price : void 0);
    if (price !== quote.price || current.name !== quote.product.name)
      throw new PurchaseError("O pre\xE7o mudou. Abra Logins novamente antes de comprar.");
    const order = await stockOrders.buy({
      botId: client.db.id,
      userId: user.id,
      buyerWid: user.wid.replace(/\D/g, ""),
      pollId: data.msgId.id,
      service: current.name,
      price,
      cost: current.cost,
      additional: [current.description, current.durationDays > 0 ? `Dura\xE7\xE3o: ${current.durationDays} dias.` : "", setting?.text].filter(Boolean).join("\n")
    });
    await deliverApiOrder(client, data.sender, order);
    if (order.status === "COMPLETED" && setting) {
      await notifySales(client, { ...setting, price }, user.wid).catch(() => void 0);
    }
    await notifyAdmin(client, `Pedido API ${order.id}
Produto: ${order.serviceName}
Cliente: ${user.wid}
Venda: R$ ${order.price.toFixed(2)}
Custo: R$ ${order.cost.toFixed(2)}
Status: ${order.status}`).catch(() => void 0);
  } catch (error) {
    await client.sendText(data.sender, error instanceof PurchaseError ? error.message : "N\xE3o foi poss\xEDvel concluir a solicita\xE7\xE3o. Confira seu Hist\xF3rico de Logins antes de tentar novamente ou contate o suporte.");
  }
}

// src/buttons/logins.ts
var prisma3 = new import_client3.PrismaClient();
var pagination = {};
var limit2 = 8;
async function showLogins(client, data, offset = 0) {
  if (await showTelegramLogins(client, data, offset))
    return;
  if (usesStockApi(client))
    return showApiLogins(client, data, offset);
  pagination[data.sender] = offset;
  const logins = await prisma3.loginsSettings.findMany({
    where: {
      bot: {
        wid: client.wid
      }
    },
    select: {
      _count: {
        select: {
          logins: true
        }
      },
      name: true,
      price: true
    },
    skip: offset,
    take: limit2
  });
  if (logins.length === 0) {
    const text2 = offset === 0 ? "Sem logins a venda." : "Fim da lista de logins.";
    client.sendText(data.chatId, text2);
    return;
  }
  const listLogins = [];
  for (const { name, price, _count } of logins) {
    if (_count.logins === 0)
      continue;
    const text2 = `${name} - R$ ${price} - Estoque: ${_count.logins}`;
    if (!listLogins.includes(text2))
      listLogins.push(text2);
  }
  if (listLogins.length === 0) {
    client.sendText(data.chatId, "Sem estoque de logins.");
    return;
  }
  if (offset === 0)
    listLogins.push("Proximo");
  else
    listLogins.push("Proximo", "Anterior");
  const bot = await prisma3.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  const user = await prisma3.user.findFirst({
    where: {
      wid: data.sender,
      bot: {
        wid: client.wid
      }
    }
  });
  const text = `*\u25C6 \u2501\u2501\u2501\u2501\u276A\u272A\u276B\u2501\u2501\u2501\u2501 \u25C6*
*\u25C6 Seu saldo: R$ ${user?.balance}*
*\u25C6 \u2501\u2501\u2501\u2501\u276A\u272A\u276B\u2501\u2501\u2501\u2501 \u25C6*

${bot?.textLogin}`;
  await client.sendPollMessage(data.chatId, text.trim(), listLogins, {
    selectableCount: 1
  });
}
async function responseBuyLogin(client, data) {
  if (await responseTelegramLogin(client, data))
    return;
  if (usesStockApi(client))
    return responseApiLogin(client, data);
  if (!data.selected?.added)
    return;
  const { added: selected } = data.selected;
  if (selected === "Proximo") {
    const offset = pagination[data.sender] || 0;
    pagination[data.sender] = offset + limit2;
    await showLogins(client, data, pagination[data.sender]);
    return;
  }
  if (selected === "Anterior") {
    const offset = pagination[data.sender] || 0;
    pagination[data.sender] = Math.max(0, offset - limit2);
    await showLogins(client, data, pagination[data.sender]);
    return;
  }
  const logins = await prisma3.loginsSettings.findMany({
    where: {
      bot: {
        wid: client.wid
      }
    }
  });
  if (logins.length === 0) {
    client.sendText(data.chatId, "Sem estoque de logins.");
    return;
  }
  const login = logins.find((item) => {
    const [name] = selected.split(" - ");
    return name === item.name;
  });
  if (!login) {
    client.sendText(data.chatId, "Login n\xE3o encontrado.");
    return;
  }
  if (login.price === 0) {
    client.sendText(data.chatId, "Login n\xE3o configurado.");
    return;
  }
  const user = await prisma3.user.findFirst({
    where: {
      wid: data.sender,
      bot: {
        wid: client.wid
      }
    }
  });
  if (!user) {
    client.sendText(data.chatId, "Voc\xEA n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  if (user.balance < login.price) {
    client.sendText(data.chatId, "Voc\xEA n\xE3o tem saldo suficiente.");
    return;
  }
  const firstLogin = await prisma3.logins.findFirst({
    where: {
      name: login.name
    }
  });
  if (!firstLogin) {
    client.sendText(data.chatId, "Sem estoque desse login.");
    return;
  }
  await prisma3.user.update({
    where: {
      id: user.id
    },
    data: {
      balance: user.balance - login.price,
      loginsHistory: {
        create: {
          loginName: login.name,
          loginUser: firstLogin.user,
          loginPassword: firstLogin.password,
          loginAdditional: firstLogin.additional,
          loginPrice: login.price,
          bot: {
            connect: {
              wid: client.wid
            }
          }
        }
      }
    }
  });
  await prisma3.logins.delete({
    where: {
      id: firstLogin.id
    }
  });
  const now = /* @__PURE__ */ new Date();
  now.setMonth(now.getMonth() + 1);
  const nextMonth = now.toLocaleString("pt-BR");
  const text = `*\u{1F4F1} LOGIN COMPRADO COM SUCESSO \u{1F4F1}*

*\u{1F4C5} DATA RENOVA\xC7\xC3O:* ${nextMonth}

\u269C ${login.name} \u269C

*\u{1F464} Usu\xE1rio:* ${firstLogin.user}
*\u{1F511} Senha:* ${firstLogin.password}
` + (firstLogin.additional ? `*\u2139\uFE0F Informa\xE7\xF5es Adicional:* ${firstLogin.additional}` : "") + (login.text ? `

${login.text}` : "");
  const textAdmin = `*\u{1F6CD}\uFE0F VENDA \u{1F6CD}\uFE0F*

Usu\xE1rio: wa.me/${data.sender.replace(/\D/g, "")}
Saldo antes: R$ ${user.balance.toFixed(2)}
Saldo depois: R$ ${(user.balance - login.price).toFixed(2)}

\u269C Login: ${login.name}
*\u{1F4C5} DATA RENOVA\xC7\xC3O:* ${nextMonth}
*\u{1F464} Usu\xE1rio:* ${firstLogin.user}
*\u{1F511} Senha:* ${firstLogin.password}
` + (firstLogin.additional ? `*\u2139\uFE0F Informa\xE7\xF5es Adicional:* ${firstLogin.additional}` : "");
  let filename = "./assets/login.jpeg";
  if (login.image) {
    filename = `./assets/${Date.now()}.png`;
    (0, import_fs2.writeFileSync)(filename, login.image);
  }
  await client.sendImage(data.chatId, filename, "login.jpeg", text.trim());
  await notifySales(client, login, user.wid);
  if (login.image)
    (0, import_fs2.rmSync)(filename);
  notifyAdmin(client, textAdmin.trim());
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  responseBuyLogin,
  showLogins
});
