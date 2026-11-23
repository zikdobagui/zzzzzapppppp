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

// src/commands/pix.ts
var pix_exports = {};
__export(pix_exports, {
  commandPix: () => commandPix
});
module.exports = __toCommonJS(pix_exports);

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

// src/commands/pix.ts
var import_qr_image = __toESM(require("qr-image"));

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

// src/commands/pix.ts
async function commandPix(client, message, command) {
  if (await tryTelegramPix(client, message, command))
    return;
  const amount = Number(command.args?.[0]?.replace(/[^\d.]/g, ""));
  if (!amount || amount <= 0) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar um valor para o pix. Exemplo: /pix 10"
    );
    return;
  }
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (bot === null) {
    client.sendText(message.from, "O bot n\xE3o est\xE1 configurado.");
    return;
  }
  if (amount < bot.pixMin) {
    client.sendText(
      message.from,
      `O valor m\xEDnimo para o pix \xE9 de R$ ${bot.pixMin.toFixed(2)}.`
    );
    return;
  }
  if (amount > bot.pixMax) {
    client.sendText(
      message.from,
      `O valor m\xE1ximo para o pix \xE9 de R$ ${bot.pixMax.toFixed(2)}.`
    );
    return;
  }
  const user = await prisma_default.user.findFirst({
    where: {
      wid: message.author || message.from,
      bot: {
        wid: client.wid
      }
    }
  });
  if (user === null) {
    client.sendText(message.from, "Voc\xEA n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  if (bot.pixType === "manual") {
    if (!bot.pixManualKey) {
      client.sendText(
        message.from,
        "O pix manual n\xE3o est\xE1 configurado, entre em contato com o administrador."
      );
      return;
    }
    await client.sendText(
      message.from,
      `*PIX MANUAL*

*Chave Pix:* ${bot.pixManualKey}
*Informa\xE7\xF5es:* ${bot.pixManualAdditional}

` + bot.textPixManual
    );
    await client.sendText(message.from, bot.pixManualKey);
    return;
  }
  const res = await pixCreate(bot.mercadoPagoToken, amount);
  if (res.status === false) {
    client.sendText(message.from, `ERRO: ${res.message}`);
    return;
  }
  const text = `*Pix gerado com sucesso*

\`\`\`Copie e cole o codigo abaixo ou escaneie o QRCode abaixo no aplicativo do seu banco.
Voc\xEA tem at\xE9 10 minutos para pagar.
Seu dinheiro sera adicionado na sua carteira de imediato.\`\`\`
*Valor:* R$ ${amount.toFixed(2)}
`;
  const png = import_qr_image.default.imageSync(res.response?.qrcode, { type: "png" });
  let base64 = Buffer.from(png).toString("base64");
  base64 = `data:image/png;base64,${base64}`;
  await client.sendImageFromBase64(message.from, base64, "qr_code.png", text);
  await client.sendText(message.from, res.response?.qrcode);
  const intervalId = setInterval(async () => {
    const resultPix = await pixGet(bot.mercadoPagoToken, Number(res.response?.id));
    if (resultPix.status === false)
      return;
    clearInterval(intervalId);
    const balanceDouble = bot.doubleBalance ? resultPix.response?.amount : 0;
    const balance = user.balance + resultPix.response?.amount + balanceDouble;
    await prisma_default.user.update({
      where: {
        id: user.id
      },
      data: {
        balance: { increment: resultPix.response?.amount + balanceDouble },
        pixHistory: {
          create: {
            amount: resultPix.response?.amount,
            bot: {
              connect: {
                wid: client.wid
              }
            }
          }
        }
      }
    });
    if (user.affiliated) {
      const balanceAffiliated = resultPix.response?.amount * 0.05;
      const userAffiliated = await prisma_default.user.findFirst({
        where: {
          wid: user.affiliated,
          bot: {
            wid: client.wid
          }
        }
      });
      if (userAffiliated) {
        await prisma_default.user.update({
          where: {
            id: userAffiliated.id
          },
          data: {
            balance: {
              increment: balanceAffiliated
            }
          }
        });
      }
    }
    const text2 = `*Pix aprovado*

*Valor:* R$ ${resultPix.response?.amount?.toFixed(2)}
Valor adicionado na carteira com sucesso.`;
    await client.sendImage(message.from, "./assets/pix.jpeg", "pix.jpeg", text2);
    notifyAdmin(
      client,
      `Usu\xE1rio ${message.author || message.from} adicionou saldo via pix de R$ ${resultPix.response?.amount?.toFixed(2)}`
    );
  }, 5e3);
  setTimeout(async () => {
    clearInterval(intervalId);
    await client.sendText(
      message.from,
      "Voc\xEA demorou demais para pagar o pix. E a opera\xE7\xE3o foi cancelada!"
    );
    notifyAdmin(
      client,
      `Usu\xE1rio ${message.author || message.from} n\xE3o pagou o pix de R$ ${amount.toFixed(2)}`
    );
  }, 60 * 1e3 * 10);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandPix
});
