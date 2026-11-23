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

// src/services/stockOrders.ts
var stockOrders_exports = {};
__export(stockOrders_exports, {
  PurchaseError: () => PurchaseError,
  stockOrderService: () => stockOrderService,
  stockOrders: () => stockOrders
});
module.exports = __toCommonJS(stockOrders_exports);
var import_node_crypto = require("crypto");

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PurchaseError,
  stockOrderService,
  stockOrders
});
