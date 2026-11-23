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

// src/commands/stockApi.ts
var stockApi_exports = {};
__export(stockApi_exports, {
  commandApiOrder: () => commandApiOrder,
  commandApiOrders: () => commandApiOrders,
  commandApiProducts: () => commandApiProducts,
  commandApiRefund: () => commandApiRefund
});
module.exports = __toCommonJS(stockApi_exports);

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

// src/commands/notifySales.ts
var import_client2 = require("@prisma/client");
var prisma2 = new import_client2.PrismaClient();

// src/buttons/apiLogins.ts
function usesStockApi(client) {
  return stockApiEnabled() && client.db?.name === "Principal";
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

// src/commands/stockApi.ts
async function commandApiProducts(client, message) {
  if (!client.db || !usesStockApi(client)) {
    await client.sendText(message.from, "A API est\xE1 habilitada apenas para o bot Principal.");
    return;
  }
  try {
    const products = await listStock();
    const rows = [];
    for (const product of products) {
      const setting = await prisma_default.loginsSettings.findUnique({ where: { name: product.name } });
      if (setting && setting.botId !== client.db.id) {
        rows.push(`${product.name}: nome j\xE1 cadastrado em outro bot; contate o suporte.`);
        continue;
      }
      if (!setting)
        await prisma_default.loginsSettings.create({ data: { name: product.name, botId: client.db.id } });
      let price = "ajuste necess\xE1rio (pre\xE7o menor que custo)";
      try {
        price = `R$ ${retailPrice(product.cost, setting?.price).toFixed(2)}`;
      } catch {
      }
      rows.push(`${product.name}
Custo: R$ ${product.cost.toFixed(2)} | Venda: ${price} | Estoque: ${product.stock}`);
    }
    await client.sendText(message.from, `*Cat\xE1logo da API*

${rows.join("\n\n")}

Pre\xE7o personalizado: /price NOME EXATO|10,40
Margem padr\xE3o: STOCK_API_MARGIN_PERCENT no .env.`);
  } catch {
    await client.sendText(message.from, "N\xE3o foi poss\xEDvel consultar o cat\xE1logo. Confira a chave da API e tente novamente.");
  }
}
async function commandApiOrder(client, message, command) {
  const id = command.args[0];
  if (!client.db || !id) {
    await client.sendText(message.from, "Uso: /apipedido ID_DO_PEDIDO");
    return;
  }
  if (message.from.endsWith("@g.us")) {
    await client.sendText(message.from, "Consulte seu pedido no privado com o bot.");
    return;
  }
  const user = await prisma_default.user.findFirst({ where: { botId: client.db.id, wid: message.from } });
  let order = user && await prisma_default.stockApiOrder.findFirst({ where: { id, botId: client.db.id, userId: user.id } });
  if (!order) {
    await client.sendText(message.from, "Pedido n\xE3o encontrado para sua conta.");
    return;
  }
  if (order.status === "RECEIVED")
    order = await stockOrders.finish(order.id);
  if (order.status === "REJECTED")
    order = await stockOrders.refund(order.id);
  await deliverApiOrder(client, message.from, order);
}
async function commandApiOrders(client, message) {
  if (!client.db)
    return;
  const orders = await prisma_default.stockApiOrder.findMany({ where: { botId: client.db.id, status: { notIn: ["COMPLETED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 30 });
  await client.sendText(message.from, orders.length ? orders.map((order) => `${order.id}
${order.serviceName} | R$ ${order.price.toFixed(2)} | ${order.status}
${order.errorCode || "-"} | ${order.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`).join("\n\n") : "Nenhum pedido pendente na API.");
}
async function commandApiRefund(client, message, command) {
  if (!client.db)
    return;
  const order = await prisma_default.stockApiOrder.findFirst({ where: { id: command.args[0] || "", botId: client.db.id } });
  if (!order) {
    await client.sendText(message.from, "Pedido n\xE3o encontrado. Uso: /apiestornar ID_DO_PEDIDO");
    return;
  }
  try {
    await stockOrders.refund(order.id, order.status !== "REJECTED");
    await client.sendText(message.from, `Pedido ${order.id} estornado. O saldo do cliente foi devolvido. Este comando n\xE3o cancela cobran\xE7as no fornecedor.`);
  } catch (error) {
    if (!(error instanceof PurchaseError))
      throw error;
    await client.sendText(message.from, error.message);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandApiOrder,
  commandApiOrders,
  commandApiProducts,
  commandApiRefund
});
