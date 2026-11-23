"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/services/mercadopago.ts
var mercadopago_exports = {};
__export(mercadopago_exports, {
  pixCreate: () => pixCreate,
  pixGet: () => pixGet
});
module.exports = __toCommonJS(mercadopago_exports);
var import_mercadopago = __toESM(require("mercadopago"));
async function pixCreate(mercadoPagoToken, amount) {
  try {
    if (!mercadoPagoToken) {
      return {
        status: false,
        message: "Token n\xE3o encontrado"
      };
    }
    import_mercadopago.default.configurations.setAccessToken(mercadoPagoToken);
    const rand = Math.floor(Math.random() * (9999 - 1e3 + 1) + 1e3);
    const res = await import_mercadopago.default.payment.create({
      installments: 0,
      payment_method_id: "pix",
      transaction_amount: amount,
      description: "",
      payer: {
        email: `joseamauri${rand}@gmail.com`,
        entity_type: "individual",
        type: "customer",
        identification: {
          type: "phone",
          number: `119931${rand}`
        }
      }
    });
    if (res.body?.status !== "pending") {
      return {
        status: false,
        message: "Erro ao gerar pix",
        response: {
          status: res?.response?.status,
          qrcode: ""
        }
      };
    }
    return {
      status: true,
      message: "Pix gerado com sucesso",
      response: {
        status: res.response?.status,
        qrcode: res?.response?.point_of_interaction?.transaction_data?.qr_code,
        id: res.response?.id
      }
    };
  } catch (error) {
    console.log(error);
    return {
      status: false,
      message: "Error interno ao gerar pix"
    };
  }
}
async function pixGet(mercadoPagoToken, id) {
  try {
    if (!mercadoPagoToken) {
      return {
        status: false,
        message: "Token n\xE3o encontrado"
      };
    }
    import_mercadopago.default.configurations.setAccessToken(mercadoPagoToken);
    const res = await import_mercadopago.default.payment.get(id);
    if (res.body?.status !== "approved") {
      return {
        status: false,
        message: "Pix n\xE3o aprovado",
        response: {
          status: res?.response?.status,
          amount: res?.response?.transaction_amount
        }
      };
    }
    return {
      status: true,
      message: "Pix aprovado com sucesso",
      response: {
        status: res.response?.status,
        amount: res.response?.transaction_amount
      }
    };
  } catch (error) {
    console.log(error);
    return {
      status: false,
      message: "Error interno ao gerar pix"
    };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  pixCreate,
  pixGet
});
