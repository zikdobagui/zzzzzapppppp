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

// src/services/stockApi.ts
var stockApi_exports = {};
__export(stockApi_exports, {
  StockApiError: () => StockApiError,
  listStock: () => listStock,
  parseAccess: () => parseAccess,
  parseStock: () => parseStock,
  reserveStock: () => reserveStock,
  retailPrice: () => retailPrice,
  stockApiEnabled: () => stockApiEnabled
});
module.exports = __toCommonJS(stockApi_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  StockApiError,
  listStock,
  parseAccess,
  parseStock,
  reserveStock,
  retailPrice,
  stockApiEnabled
});
