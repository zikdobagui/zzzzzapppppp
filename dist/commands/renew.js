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

// src/commands/renew.ts
var renew_exports = {};
__export(renew_exports, {
  commandRenew: () => commandRenew
});
module.exports = __toCommonJS(renew_exports);

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

// src/services/mercadopago.ts
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

// src/commands/renew.ts
var import_qr_image = __toESM(require("qr-image"));
async function commandRenew(client, message, command) {
  const [_week] = command.args;
  const week = Number(_week);
  if (!week || week <= 0) {
    await client.sendText(
      message.from,
      "Voc\xEA precisa informar a quantidade de semanas. Exemplo: /renovar 1"
    );
    return;
  }
  const botMaster = await prisma_default.botMaster.findFirst();
  if (!botMaster)
    return;
  const userId = message.author || message.from;
  const owners = process.env.OWNER_PHONE?.split(",")?.map((owner) => `${owner.trim()}@c.us`) || [];
  const isOwner = owners.includes(userId);
  if (isOwner) {
    const date = /* @__PURE__ */ new Date();
    date.setDate(date.getDate() + week * 7);
    await prisma_default.bot.update({
      where: {
        wid: client.wid
      },
      data: {
        expireAt: date
      }
    });
    const text2 = `*Bot Renovado com sucesso!*

*Data de expira\xE7\xE3o:* ${date.toLocaleString("pt-BR")}`;
    client.sendText(message.from, text2);
    return;
  }
  const amount = botMaster.priceWeek * week;
  const res = await pixCreate(botMaster.mercadoPagoToken, amount);
  if (res.status === false) {
    client.sendText(message.from, `ERRO: ${res.message}`);
    return;
  }
  const text = `*Pix gerado com sucesso*

\`\`\`Copie e cole o codigo abaixo ou escaneie o QRCode abaixo no aplicativo do seu banco.Voc\xEA tem at\xE9 10 minutos para pagar.
Seu bot ser\xE1 renovado automaticamente.\`\`\`
*Valor:* R$ ${amount.toFixed(2)}
`;
  await client.sendText(message.from, text);
  const png = import_qr_image.default.imageSync(res.response?.qrcode, { type: "png" });
  let base64 = Buffer.from(png).toString("base64");
  base64 = `data:image/png;base64,${base64}`;
  await client.sendImageFromBase64(message.from, base64, "qr_code");
  await client.sendText(message.from, res.response?.qrcode);
  const intervalid = setInterval(async () => {
    const resultPix = await pixGet(botMaster.mercadoPagoToken, Number(res.response?.id));
    if (resultPix.status === true) {
      clearInterval(intervalid);
      const date = /* @__PURE__ */ new Date();
      date.setDate(date.getDate() + week * 7);
      await prisma_default.bot.update({
        where: {
          wid: client.wid
        },
        data: {
          expireAt: date
        }
      });
      const text2 = `*Bot Renovado com sucesso!*

*Valor:* R$ ${resultPix.response?.amount?.toFixed(2)}
*Data de expira\xE7\xE3o:* ${date.toLocaleString("pt-BR")}`;
      client.sendText(message.from, text2);
    }
  }, 5e3);
  setTimeout(() => {
    clearInterval(intervalid);
    client.sendText(message.from, "O pix expirou.");
  }, 60 * 1e3 * 10);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandRenew
});
