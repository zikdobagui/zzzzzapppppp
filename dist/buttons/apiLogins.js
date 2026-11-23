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

// src/buttons/apiLogins.ts
var apiLogins_exports = {};
__export(apiLogins_exports, {
  deliverApiOrder: () => deliverApiOrder,
  responseApiLogin: () => responseApiLogin,
  showApiLogins: () => showApiLogins,
  usesStockApi: () => usesStockApi
});
module.exports = __toCommonJS(apiLogins_exports);

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

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
  const key = process.env.STOCK_API_KEY?.trim();
  if (!key)
    throw new StockApiError("MISSING_KEY");
  const base = new URL(process.env.STOCK_API_URL || "https://vendasdoramon.squareweb.app");
  if (base.protocol !== "https:" || base.username || base.password)
    throw new StockApiError("INVALID_URL");
  let response;
  try {
    response = await fetch(new URL(endpoint, base), {
      method: body ? "POST" : "GET",
      headers: { "X-Stock-Key": key, ...body ? { "Content-Type": "application/json" } : {} },
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
var import_node_crypto = require("crypto");
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
    const requestKey = (0, import_node_crypto.createHash)("sha256").update(JSON.stringify([input.botId, input.userId, input.pollId])).digest("hex");
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
        return tx.stockApiOrder.create({ data: { id: `zap-${(0, import_node_crypto.randomUUID)()}`, requestKey, botId: input.botId, userId: input.userId, serviceName: input.service, price: input.price, cost: input.cost } });
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
    for (const [key, value] of polls)
      if (value.expires < Date.now())
        polls.delete(key);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  deliverApiOrder,
  responseApiLogin,
  showApiLogins,
  usesStockApi
});
