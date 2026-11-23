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
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
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

// src/commands/newBot.ts
var newBot_exports = {};
__export(newBot_exports, {
  commandNewBot: () => commandNewBot
});
module.exports = __toCommonJS(newBot_exports);
var import_client11 = require("@prisma/client");

// src/helpers/whatsappCompatibility.ts
function patchLidUserPrefs(prefs) {
  if (typeof prefs.getMeLidUserOrThrow === "function")
    return false;
  if (typeof prefs.getMaybeMeLidUser !== "function" && typeof prefs.getMaybeMeLid !== "function") {
    throw new Error("WhatsApp incompat\xEDvel: getter de LID indispon\xEDvel.");
  }
  Object.defineProperty(prefs, "getMeLidUserOrThrow", {
    configurable: true,
    writable: true,
    value: function() {
      const lid = typeof prefs.getMaybeMeLidUser === "function" ? prefs.getMaybeMeLidUser() : prefs.getMaybeMeLid();
      if (!lid)
        throw new Error("WhatsApp ainda n\xE3o disponibilizou o LID da sess\xE3o.");
      return lid;
    }
  });
  return true;
}
async function installWhatsAppCompatibility(client) {
  await client.page.evaluate(`(${patchLidUserPrefs.toString()})(WPP.whatsapp.UserPrefs)`);
}

// src/connection.ts
var wppconnect = __toESM(require("@wppconnect-team/wppconnect"));
var import_promises = require("readline/promises");
var import_node_process = require("process");

// src/helpers/sessionLogin.ts
async function loginSavedSessionFirst(client, requestPhone) {
  const previousStatus = client.statusFind;
  let pairingStarted = false;
  let rejectPairing;
  const pairingFailure = new Promise((_resolve, reject) => {
    rejectPairing = reject;
  });
  client.statusFind = (status, session) => {
    previousStatus?.(status, session);
    if (status !== "notLogged" || pairingStarted)
      return;
    pairingStarted = true;
    (async () => {
      const phone = await requestPhone();
      if (!/^[1-9]\d{9,14}$/.test(phone)) {
        throw new Error("Informe o c\xF3digo do pa\xEDs, DDD e n\xFAmero, somente com d\xEDgitos.");
      }
      client.options.phoneNumber = phone;
      await client.page.evaluate(`
			(async () => {
				WPP.on('conn.link_code_change', window.onLinkCode);
				WPP.on('conn.link_code_expired', window.onLinkCodeExpired);
				WPP.on('conn.link_code_error', error => window.onLinkCodeError(error.message));
				await WPP.conn.startLinkDeviceCodeForPhoneNumber(${JSON.stringify(phone)});
			})()
			`);
    })().catch(rejectPairing);
  };
  try {
    if (!await Promise.race([client.waitForLogin(), pairingFailure])) {
      throw new Error("N\xE3o foi poss\xEDvel autenticar a sess\xE3o do WhatsApp.");
    }
  } finally {
    client.statusFind = previousStatus;
  }
}

// src/connection.ts
async function createBot(bot, options) {
  const logger = wppconnect.defaultLogger;
  const session = bot?.name || "Principal";
  const codeMode = !options?.catchQR;
  const requestPhone = async () => {
    let phoneNumber = options?.phoneNumber || (session === "Principal" ? process.env.WA_PAIRING_PHONE?.trim() || process.env.BOT_PHONE?.trim() : bot?.wid.split("@")[0]);
    if (session === "Principal" && import_node_process.stdin.isTTY) {
      const terminal = (0, import_promises.createInterface)({ input: import_node_process.stdin, output: import_node_process.stdout });
      try {
        console.log("A sess\xE3o n\xE3o est\xE1 autenticada. Conecte pelo c\xF3digo para salvar uma nova sess\xE3o.");
        const answer = await terminal.question(`N\xFAmero do WhatsApp com pa\xEDs e DDD${phoneNumber ? ` (Enter para usar ${phoneNumber})` : ""}: `);
        phoneNumber = answer.trim() ? answer.replace(/\D/g, "") : phoneNumber;
      } finally {
        terminal.close();
      }
    }
    if (!phoneNumber)
      throw new Error("Para gerar o c\xF3digo, informe o n\xFAmero no terminal ou configure WA_PAIRING_PHONE no .env.");
    return phoneNumber;
  };
  if (process.env.NODE_ENV === "production") {
    logger.level = "http";
  }
  const client = await wppconnect.create({
    session,
    logger,
    useChrome: true,
    headless: true,
    logQR: false,
    catchLinkCode: (code) => {
      console.log(`
C\xF3digo de conex\xE3o do bot "${session}": ${code}
No WhatsApp do n\xFAmero informado, abra Aparelhos conectados > Conectar um aparelho > Conectar com n\xFAmero de telefone e digite o c\xF3digo acima.
`);
    },
    catchQR: (_base64, asciiQR) => {
      console.log(`
QR Code do bot "${session}" \u2014 no WhatsApp, abra Aparelhos conectados > Conectar um aparelho e escaneie:
${asciiQR}`);
    },
    autoClose: 0,
    deviceSyncTimeout: 0,
    updatesLog: true,
    browserArgs: [
      "--log-level=3",
      "--no-default-browser-check",
      "--disable-site-isolation-trials",
      "--no-experiments",
      "--ignore-gpu-blacklist",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-default-apps",
      "--enable-features=NetworkService",
      "--disable-setuid-sandbox",
      "--no-sandbox",
      // Extras
      "--disable-webgl",
      "--disable-threaded-animation",
      "--disable-threaded-scrolling",
      "--disable-in-process-stack-traces",
      "--disable-histogram-customizer",
      "--disable-gl-extensions",
      "--disable-composited-antialiasing",
      "--disable-canvas-aa",
      "--disable-3d-apis",
      "--disable-accelerated-2d-canvas",
      "--disable-accelerated-jpeg-decoding",
      "--disable-accelerated-mjpeg-decode",
      "--disable-app-list-dismiss-on-blur",
      "--disable-accelerated-video-decode"
    ],
    disableWelcome: true,
    waitForLogin: true,
    puppeteerOptions: {
      userDataDir: `./tokens/${session}`
    },
    ...options,
    ...codeMode ? { phoneNumber: void 0, waitForLogin: false, catchQR: () => void 0 } : {}
  });
  if (codeMode) {
    try {
      await loginSavedSessionFirst(client, requestPhone);
    } catch (error) {
      await client.close().catch(() => void 0);
      throw error;
    }
    let reconnecting;
    client.onStateChange(async () => {
      try {
        if (!await client.page.evaluate("WPP.conn.isRegistered()") && !reconnecting) {
          reconnecting = loginSavedSessionFirst(client, requestPhone).finally(() => {
            reconnecting = void 0;
          });
          await reconnecting;
          await installWhatsAppCompatibility(client);
        }
      } catch (error) {
        console.error(`Falha ao reconectar a sess\xE3o "${session}":`, error instanceof Error ? error.message : "erro de conex\xE3o");
      }
    });
  }
  await installWhatsAppCompatibility(client);
  return Object.assign(client, { db: bot });
}

// src/commands/newBot.ts
var import_qr_image4 = __toESM(require("qr-image"));

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

// src/helpers/notify.ts
var import_util = require("util");
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
async function notifyOwner(client, text) {
  const owners = process.env.OWNER_PHONE?.split(",")?.map((owner) => `${owner.trim()}@c.us`) || [];
  for (const owner of owners) {
    await client.sendText(owner, text);
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  }
}
async function notifyError(client, message, name, error) {
  console.log(error);
  const text = `ERROR ${name}

User: wa.me/${(message.author || message.from).replace(/\D/g, "")}
Chat: ${message.from}
Message: ${message.body}


${(0, import_util.inspect)(error)}`;
  return notifyOwner(client, text);
}

// src/index.ts
var import_config = require("dotenv/config");

// src/helpers/runtimeLock.ts
var import_node_fs = require("fs");
var import_node_path = __toESM(require("path"));
function acquireRuntimeLock(filename = import_node_path.default.resolve(".runtime/bot.lock")) {
  (0, import_node_fs.mkdirSync)(import_node_path.default.dirname(filename), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    let fd;
    try {
      fd = (0, import_node_fs.openSync)(filename, "wx");
    } catch (error) {
      if (error.code !== "EEXIST")
        throw error;
      let pid;
      try {
        pid = Number((0, import_node_fs.readFileSync)(filename, "utf8").trim());
      } catch {
        throw new Error("Outra inicializa\xE7\xE3o est\xE1 em andamento. Tente novamente em alguns segundos.");
      }
      if (!Number.isSafeInteger(pid) || pid <= 0)
        throw new Error("Trava do bot inv\xE1lida. Confira os processos antes de remover .runtime/bot.lock.");
      try {
        process.kill(pid, 0);
      } catch (e) {
        if (e.code === "ESRCH") {
          try {
            (0, import_node_fs.unlinkSync)(filename);
          } catch {
          }
          continue;
        }
        throw e;
      }
      throw new Error(`O bot j\xE1 est\xE1 em execu\xE7\xE3o (PID ${pid}). Use a inst\xE2ncia existente ou encerre-a antes de executar npm start novamente.`);
    }
    try {
      (0, import_node_fs.writeFileSync)(fd, String(process.pid));
    } finally {
      (0, import_node_fs.closeSync)(fd);
    }
    return () => {
      try {
        if ((0, import_node_fs.existsSync)(filename) && (0, import_node_fs.readFileSync)(filename, "utf8").trim() === String(process.pid))
          (0, import_node_fs.unlinkSync)(filename);
      } catch {
      }
    };
  }
  throw new Error("Outra inicializa\xE7\xE3o est\xE1 em andamento. Tente novamente.");
}

// src/index.ts
var import_client10 = require("@prisma/client");

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
async function telegramApi(path3, options = {}) {
  const key2 = (options.catalogo ? process.env.WHATSAPP_CATALOG_API_KEY : process.env.WHATSAPP_API_KEY)?.trim();
  const base = process.env.TELEGRAM_BASE_URL?.trim();
  if (!key2 || !base)
    throw new TelegramApiError(503, false, "NOT_CONFIGURED");
  let url;
  try {
    url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
      throw new Error();
    url = new URL(path3, url);
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
function accountSummaryText(local, remote) {
  const localText = `*\u25C6 Saldo para compras no WhatsApp:* R$ ${local.balance.toFixed(2)}
*\u25C6 Compras no WhatsApp:* ${local.purchases}
`;
  if (remote.state === "linked") {
    return `*\u25C6 Conta Telegram vinculada*
*\u25C6 Seu saldo:* R$ ${remote.balance.toFixed(2)}
*\u25C6 Compras realizadas:* ${remote.purchases}
`;
  }
  if (remote.state === "unavailable")
    return "*\u25C6 Saldo e compras temporariamente indispon\xEDveis*\n";
  return localText;
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

// src/events/telegram.ts
var pending = /* @__PURE__ */ new Map();
var busy2 = /* @__PURE__ */ new Set();
var skipped = /* @__PURE__ */ new Set();
var TELEGRAM_STORE_OPTION = "\u27A1\uFE0F N\xE3o tenho Telegram \xB7 ir para a loja";
var TELEGRAM_HELP_OPTION = "\u{1F198} Preciso de ajuda";
async function inviteTelegram(client, to) {
  const key2 = `${client.wid}:${to}`;
  for (const [entry, deadline] of pending)
    if (deadline < Date.now())
      pending.delete(entry);
  pending.set(key2, Date.now() + 5 * 60 * 1e3);
  let destination = "o bot da nossa loja no Telegram ou o site";
  const configuredUrl = process.env.TELEGRAM_BOT_URL?.trim();
  if (configuredUrl && /^https:\/\/t\.me\/[a-zA-Z0-9_]+$/.test(configuredUrl))
    destination = configuredUrl;
  await client.sendText(
    to,
    `*\u{1F517} VINCULE SUA CONTA DO TELEGRAM*
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

J\xE1 \xE9 cliente no Telegram? Vincule seu cadastro para consultar seus dados e saldo aqui no WhatsApp.

1\uFE0F\u20E3 Abra ${destination}
2\uFE0F\u20E3 Toque em *MEU PERFIL \u2192 \u{1F517} VINCULAR WHATSAPP*
3\uFE0F\u20E3 *Mande aqui o c\xF3digo que aparecer no seu perfil.*

Cada cliente tem seu pr\xF3prio c\xF3digo. Vou aguardar o seu por 5 minutos.`
  );
  if (client.sendPollMessage) {
    try {
      await client.sendPollMessage(to, "\u{1F517} Vincular com o Telegram\nSelecione uma op\xE7\xE3o ou envie seu c\xF3digo nesta conversa.", [TELEGRAM_STORE_OPTION, TELEGRAM_HELP_OPTION], { selectableCount: 1 });
      return;
    } catch {
    }
  }
  await client.sendText(to, "N\xE3o tem Telegram? Digite /loja para continuar.\nPrecisa de ajuda? Digite /ajudavinculo.");
}
var money2 = (value) => typeof value === "number" && Number.isFinite(value) ? `R$ ${value.toFixed(2)}` : "N\xE3o informado";
var safe2 = (value) => value == null ? "N\xE3o informado" : String(value).replace(/[\r\n\x00-\x1f]/g, " ").slice(0, 300);
var help = "*Telegram*\n\n/vincular CODIGO \u2014 cole o c\xF3digo do Meu Perfil do Telegram/site.\n/saldotelegram \u2014 saldo e cadastro\n/historicotelegram \u2014 compras e pagamentos\n/catalogotelegram \u2014 pre\xE7os e disponibilidade\n/cancelar \u2014 cancelar envio do c\xF3digo\n\nContas vinculadas usam o saldo \xFAnico do Telegram.";
function telegramSensitive(botWid, from, body) {
  return /^\/vincular(?:\s|$)/i.test(body?.trim() || "") || pending.has(`${botWid}:${from}`);
}
async function handleTelegram(client, message) {
  const text = message.body?.trim() || "";
  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.toLowerCase();
  const commands2 = ["/telegram", "/vincular", "/saldotelegram", "/historicotelegram", "/catalogotelegram", "/cancelar", "/loja", "/ajudavinculo", "/statuspix", "/operacaotelegram"];
  const key2 = `${client.wid}:${message.from}`;
  const expires = pending.get(key2);
  if (expires && expires < Date.now())
    pending.delete(key2);
  if (!commands2.includes(command) && (!pending.has(key2) || text.startsWith("/"))) {
    if (text.startsWith("/") && command !== "/menu" || skipped.has(key2) || message.fromMe || message.isGroupMsg || !telegramEnabled(client.wid) || !/@(?:c\.us|s\.whatsapp\.net)$/.test(message.from))
      return false;
    if (busy2.has(key2))
      return true;
    busy2.add(key2);
    let needsLink = false;
    try {
      await getTelegramClient(telegramPhone(message.from));
    } catch (error) {
      if (error instanceof TelegramApiError && error.status === 404)
        needsLink = true;
      else {
        if (error instanceof TelegramApiError && error.status === 403) {
          await client.sendText(message.from, "Cadastro Telegram bloqueado. Contate o suporte.");
          return true;
        }
        needsLink = true;
      }
    } finally {
      busy2.delete(key2);
    }
    if (!needsLink)
      return false;
    return handleTelegram(client, { ...message, body: "/vincular" });
  }
  if (message.fromMe)
    return true;
  if (!telegramEnabled(client.wid)) {
    if (commands2.includes(command) && command !== "/cancelar")
      await client.sendText(message.from, "Integra\xE7\xE3o Telegram indispon\xEDvel neste bot.");
    return commands2.includes(command);
  }
  if (message.isGroupMsg || !/@(?:c\.us|s\.whatsapp\.net|lid)$/.test(message.from)) {
    await client.sendText(message.from, "Use estes comandos em conversa privada com o bot oficial.");
    return true;
  }
  if (busy2.has(key2)) {
    await client.sendText(message.from, "Aguarde a consulta anterior terminar.");
    return true;
  }
  busy2.add(key2);
  try {
    const phone = telegramPhone(message.from);
    if (command === "/statuspix" || command === "/operacaotelegram")
      await walletStatus(client, message.from, command, args[0] || "");
    else if (command === "/cancelar") {
      pending.delete(key2);
      await client.sendText(message.from, "Envio do c\xF3digo cancelado.");
    } else if (command === "/loja") {
      pending.delete(key2);
      skipped.add(key2);
      return false;
    } else if (command === "/ajudavinculo") {
      await client.sendText(message.from, "Abra o bot da loja no Telegram ou o site, entre em Meu Perfil e procure Vincular WhatsApp. Copie o c\xF3digo e envie aqui. Se n\xE3o encontrar, digite /loja e selecione Suporte no menu. Para seguir sem vincular, digite /loja.");
    } else if (command === "/telegram") {
      skipped.delete(key2);
      await inviteTelegram(client, message.from);
      await client.sendText(message.from, help);
    } else if (command === "/catalogotelegram") {
      const catalog = await getTelegramCatalog();
      if (!Array.isArray(catalog?.produtos))
        throw new TelegramApiError(502);
      await sendLines(client, message.from, "*Cat\xE1logo Telegram*", catalog.produtos.map((p) => `${safe2(p.nome)} \u2014 ${money2(p.preco)} \u2014 Estoque: ${safe2(p.estoque)}
${safe2(p.descricao)}`));
      await client.sendText(message.from, "Disponibilidade consultada agora, sem reserva. Para comprar, acesse o Telegram/site.");
    } else if (command === "/saldotelegram") {
      const user = await getTelegramClient(phone);
      await client.sendText(message.from, formatClient(user));
    } else if (command === "/historicotelegram") {
      const history = await getTelegramHistory(phone);
      if (!Array.isArray(history?.compras) || !Array.isArray(history?.pagamentos))
        throw new TelegramApiError(502);
      for (const [title, items] of [["Compras Telegram", history.compras], ["Pagamentos Telegram", history.pagamentos]]) {
        await sendLines(client, message.from, `*${title}*`, items.map((item) => `${safe2(item.data)} \u2014 ${safe2(item.servico)} / ${safe2(item.produto)} \u2014 ${money2(item.valor)}`));
      }
    } else {
      const code = command === "/vincular" ? args.join(" ") : text;
      if (!code) {
        skipped.delete(key2);
        await inviteTelegram(client, message.from);
      } else {
        pending.delete(key2);
        if (code.length > 256 || /\s/.test(code))
          throw new TelegramApiError(400);
        await linkTelegram(phone, code);
        let user;
        try {
          user = await getTelegramClient(phone);
        } catch {
          await client.sendText(message.from, "\u2705 C\xF3digo validado e cadastro vinculado. N\xE3o foi poss\xEDvel carregar seus dados agora. Use /saldotelegram para consultar, sem reenviar o c\xF3digo.");
          return true;
        }
        await client.sendText(message.from, `\u2705 C\xF3digo validado!

${formatClient(user)}

Para consultar seu hist\xF3rico: /historicotelegram`);
      }
    }
  } catch (error) {
    const e = error instanceof TelegramApiError ? error : new TelegramApiError(502);
    const messages = {
      400: "C\xF3digo ou n\xFAmero inv\xE1lido. Use /vincular CODIGO em conversa privada. Se necess\xE1rio, tente novamente ap\xF3s resolver o n\xFAmero da conta.",
      401: "A integra\xE7\xE3o precisa de ajuste nas chaves de acesso. Contate o suporte.",
      403: "Cadastro Telegram bloqueado. Contate o suporte.",
      404: "Cadastro n\xE3o vinculado ou rota indispon\xEDvel. Use /vincular CODIGO; se j\xE1 vinculou, contate o suporte.",
      409: "C\xF3digo inv\xE1lido, expirado ou j\xE1 utilizado, ou n\xFAmero j\xE1 vinculado. Consulte /saldotelegram e confira Meu Perfil no Telegram.",
      503: "Integra\xE7\xE3o Telegram n\xE3o configurada ou temporariamente indispon\xEDvel."
    };
    if (e.reason === "NOT_CONFIGURED") {
      await client.sendText(message.from, "O servi\xE7o de v\xEDnculo ainda n\xE3o foi ativado. N\xE3o foi poss\xEDvel validar seu c\xF3digo. Entre em contato com o suporte ou digite /loja para continuar sem vincular.");
      return true;
    }
    await client.sendText(message.from, e.uncertain ? "N\xE3o foi poss\xEDvel confirmar o v\xEDnculo. N\xE3o reenvie o c\xF3digo agora: consulte /saldotelegram primeiro e confira Meu Perfil no Telegram." : messages[e.status] || "N\xE3o foi poss\xEDvel consultar o Telegram agora. Tente novamente mais tarde.");
  } finally {
    busy2.delete(key2);
  }
  return true;
}
function formatClient(user) {
  return `*Cadastro Telegram*
Cliente: ${safe2(user.cliente_id)}
Usu\xE1rio: ${safe2(user.username)}
WhatsApp: ${safe2(user.whatsapp)}
Saldo: ${money2(user.saldo)}
Compras: ${safe2(user.total_compras)}`;
}
async function sendLines(client, to, title, lines) {
  if (!lines.length) {
    await client.sendText(to, `${title}
Nenhum registro.`);
    return;
  }
  let chunk = title;
  for (const line of lines) {
    if (chunk.length + line.length > 3e3) {
      await client.sendText(to, chunk);
      chunk = title;
    }
    chunk += `

${line}`;
  }
  await client.sendText(to, chunk);
}

// src/events/menu.ts
var import_client2 = require("@prisma/client");
var prisma2 = new import_client2.PrismaClient();
async function menu(client, message) {
  const botConfig = await prisma2.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  const user = await prisma2.user.findFirst({
    where: {
      wid: message.author || message.from,
      bot: {
        wid: client.wid
      }
    },
    include: {
      _count: { select: { loginsHistory: true } }
    }
  });
  if (!botConfig) {
    await client.sendText(message.from, "Bot n\xE3o configurado");
    return;
  }
  if (!user) {
    await client.sendText(message.from, "Voc\xEA n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  const name = (message.sender?.pushname || message.notifyName || message.sender?.name || "cliente").replace(/[\r\n]+/g, " ").trim().slice(0, 80) || "cliente";
  const phone = user.wid.endsWith("@c.us") || user.wid.endsWith("@s.whatsapp.net") ? `+${user.wid.split("@")[0].split(":")[0]}` : "N\xE3o dispon\xEDvel";
  const telegram = await loadTelegramSummary(client.wid, message.from);
  const summary = accountSummaryText({ balance: user.balance, purchases: user._count.loginsHistory }, telegram);
  const text = `*Ol\xE1, ${name}! Seja bem-vindo(a)!*

*\u25C6 \u2501\u2501\u2501\u2501\u276A\u272A\u276B\u2501\u2501\u2501\u2501 \u25C6*
*\u25C6 Seu n\xFAmero:* ${phone}
` + summary + `*\u25C6 \u2501\u2501\u2501\u2501\u276A\u272A\u276B\u2501\u2501\u2501\u2501 \u25C6*

${botConfig?.textMenu}`;
  const buttons2 = [
    "\u{1F4B8} Adicionar Saldo",
    "\u{1F6CD}\uFE0F Logins",
    "\u{1F464} Informa\xE7\xF5es",
    "\u{1F198} Suporte",
    "\u{1F468}\u200D\u{1F4BB} Criador"
  ];
  if (telegramEnabled(client.wid))
    buttons2.push("\u{1F517} Telegram");
  if (telegram.state === "linked")
    buttons2.push("\u{1F9FE} Hist\xF3rico Telegram");
  await client.sendPollMessage(message.from, text, buttons2, {
    selectableCount: 1
  });
  console.log(`Menu enviado para ${message.from}`);
}

// src/events/initialSettings.ts
async function initialSettings(client, message, requirePayment = true) {
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    },
    include: {
      admins: true
    }
  });
  if (!bot)
    return;
  const userId = message.author || message.from;
  function replyUser(text) {
    if (!bot) {
      client.sendText(message.from, "Error interno, contate o criador do bot!");
      return;
    }
    const admins = bot.admins.map((admin) => admin.wid);
    admins.push(bot.owner);
    if (!admins.includes(userId)) {
      client.sendText(message.from, "Bot n\xE3o configurado, tente novamente mais tarde...");
      return;
    }
    client.sendText(message.from, text);
  }
  if (bot.expireAt < /* @__PURE__ */ new Date() && process.env.BOT_PHONE !== client.wid?.replace(/\D/g, "")) {
    replyUser(
      `*Bot expirado*

*Data d\xE1 expira\xE7\xE3o:* ${bot.expireAt.toLocaleString("pt-BR")}

Use o comando /renovar para renovar o bot`
    );
    return false;
  }
  if (requirePayment && bot.pixType === "auto" && !bot.mercadoPagoToken) {
    replyUser(
      "Token do Mercado Pago n\xE3o configurado\n\nUse o comando /tokenmp para configurar"
    );
    return false;
  }
  if (requirePayment && bot.pixType === "manual" && !bot.pixManualKey) {
    replyUser("Chave pix n\xE3o configurada\n\nUse o comando /pixmanual para configurar");
    return false;
  }
  return true;
}

// src/buttons/addBalance.ts
async function addBalance(client, data) {
  if (data.chatId !== data.sender)
    return;
  const account = await loadTelegramSummary(client.wid, data.sender);
  if (account.state !== "unlinked") {
    await client.sendText(data.sender, account.state === "linked" ? "*\u{1F4B8} Adicionar saldo*\nUse /pix VALOR. Exemplo: /pix 10\nAp\xF3s aprova\xE7\xE3o, o cr\xE9dito entra no mesmo saldo do Telegram e WhatsApp." : "Saldo compartilhado temporariamente indispon\xEDvel. Tente novamente mais tarde.");
    return;
  }
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  client.sendText(data.chatId, `${bot.textPix}

Use o comando: */pix [VALOR]*

Exemplo: */pix 10*`.trim());
}

// src/commands/notifySales.ts
var import_client3 = require("@prisma/client");
var import_fs = require("fs");
var prisma3 = new import_client3.PrismaClient();
async function commandDefineNotifySales(client, message, command) {
  const widNotify = command.args.join(" ");
  if (!widNotify) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o ID do grupo, para pegar o ID do grupo, va no chat do grupo e execute o comando /id.\n\nExemplo: /notificacoes *99999999999@g.us* ou *0* para desativar as notifica\xE7\xF5es."
    );
    return;
  }
  const bot = await prisma3.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (bot === null) {
    client.sendText(message.from, "O bot n\xE3o est\xE1 configurado.");
    return;
  }
  if (widNotify === "0") {
    await prisma3.bot.update({
      where: {
        wid: client.wid
      },
      data: {
        notifySalesWid: ""
      }
    });
    client.sendText(message.from, "Notifica\xE7\xF5es desativadas.");
    return;
  }
  if (!widNotify.endsWith("@g.us")) {
    client.sendText(message.from, "O ID do grupo precisa terminar com @g.us");
    return;
  }
  await prisma3.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      notifySalesWid: widNotify
    }
  });
  await client.sendText(message.from, `Notifica\xE7\xF5es ativadas para o grupo ${widNotify}.`);
  await notifyAdmin(client, `O Admin ${message.author || message.from} ativou as notifica\xE7\xF5es para o grupo ${widNotify}.`);
}
async function notifySales(client, login, user) {
  const bot = await prisma3.bot.findUnique({
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
var import_client4 = require("@prisma/client");
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
        const pending2 = await tx.stockApiOrder.findFirst({ where: { botId: input.botId, userId: input.userId, status: { in: ["PROCESSING", "REVIEW", "RECEIVED", "REJECTED"] } } });
        if (pending2)
          throw new PurchaseError(`Voc\xEA possui um pedido pendente: ${pending2.id}. Consulte /apipedido ${pending2.id}.`);
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
var prisma4 = new import_client4.PrismaClient();
var pagination = {};
var limit2 = 8;
async function showLogins(client, data, offset = 0) {
  if (await showTelegramLogins(client, data, offset))
    return;
  if (usesStockApi(client))
    return showApiLogins(client, data, offset);
  pagination[data.sender] = offset;
  const logins = await prisma4.loginsSettings.findMany({
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
  const bot = await prisma4.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  const user = await prisma4.user.findFirst({
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
  const logins = await prisma4.loginsSettings.findMany({
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
  const user = await prisma4.user.findFirst({
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
  const firstLogin = await prisma4.logins.findFirst({
    where: {
      name: login.name
    }
  });
  if (!firstLogin) {
    client.sendText(data.chatId, "Sem estoque desse login.");
    return;
  }
  await prisma4.user.update({
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
  await prisma4.logins.delete({
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

// src/buttons/infoUser.ts
async function infoUser(client, data) {
  if (data.chatId !== data.sender)
    return;
  const user = await prisma_default.user.findFirst({
    where: {
      wid: data.sender,
      bot: {
        wid: client.wid
      }
    },
    include: {
      _count: {
        select: {
          loginsHistory: true
        }
      },
      gifts: true
    }
  });
  if (user === null) {
    client.sendText(data.chatId, "Voc\xEA n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  const phone = user.wid.replace(/\D/g, "");
  const giftTotal = user.gifts.reduce((acc, { amount }) => acc + amount, 0);
  const telegram = await loadTelegramSummary(client.wid, data.sender);
  const summary = accountSummaryText({ balance: user.balance, purchases: user._count.loginsHistory }, telegram);
  const text = `*\u{1F464} Informa\xE7\xF5es do usu\xE1rio:*

*\u{1F4F1} N\xFAmero:* ${phone}
` + summary + (telegram.state === "unlinked" ? `*\u{1F381} Gifts Resgatados:* R$ ${giftTotal.toFixed(2)}` : "");
  const options = ["\u{1FAC2} Afiliados", "\u{1F9FE} Hist\xF3rico de Logins"];
  if (telegram.state === "linked")
    options.push("\u{1F9FE} Hist\xF3rico Telegram");
  await client.sendPollMessage(data.chatId, text, options, {
    selectableCount: 1
  });
}

// src/buttons/support.ts
async function support(client, data) {
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  client.sendText(data.chatId, bot.textSupport);
}

// src/buttons/creator.ts
async function creator(client, data) {
  client.sendText(data.chatId, "Criador do Bot");
}

// src/buttons/loginsHistory.ts
async function loginsHistory(client, data) {
  if (data.chatId !== data.sender)
    return;
  const telegram = await loadTelegramSummary(client.wid, data.sender);
  if (telegram.state === "linked")
    await handleTelegram(client, { from: data.sender, body: "/historicotelegram" });
  else if (telegram.state === "unavailable")
    await client.sendText(data.chatId, "Hist\xF3rico Telegram temporariamente indispon\xEDvel.");
  const user = await prisma_default.user.findFirst({
    where: {
      wid: data.sender,
      bot: {
        wid: client.wid
      }
    },
    include: {
      affiliateds: true,
      loginsHistory: true
    }
  });
  if (user === null) {
    client.sendText(data.chatId, "Voc\xEA n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  if (user.loginsHistory.length === 0) {
    if (telegram.state !== "linked")
      await client.sendText(data.chatId, "Voc\xEA n\xE3o possui compras no hist\xF3rico local do WhatsApp.");
    return;
  }
  const history = user.loginsHistory.map((item) => {
    return `*Login:* ${item.loginName}
*Valor:* ${item.loginPrice}
*Usu\xE1rio:* ${item.loginUser}
*Senha:* ${item.loginPassword}
*Informa\xE7\xF5es adicionais:* ${item.loginAdditional}`;
  }).join("\n\n");
  client.sendText(data.chatId, `*\u{1F4CB} Hist\xF3rico de logins comprados no WhatsApp:*

${history}`);
}

// src/buttons/afiliados.ts
async function affiliateds(client, data) {
  const user = await prisma_default.user.findFirst({
    where: {
      wid: data.sender,
      bot: {
        wid: client.wid
      }
    },
    include: {
      affiliateds: true,
      loginsHistory: true
    }
  });
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (user === null) {
    client.sendText(data.chatId, "Voc\xEA n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  const phone = user.wid.replace(/\D/g, "");
  const phoneBot = client.wid?.replace(/\D/g, "");
  const affiliateds2 = user.affiliateds.reduce(
    (acc, item) => {
      const phone2 = item.wid.replace(/\D/g, "");
      const text2 = `*@${phone2}*
`;
      acc.text += text2;
      acc.list.push(item.wid);
      return acc;
    },
    { text: "", list: [] }
  );
  const linkAffiliated = `https://wa.me/${phoneBot}?text=${encodeURIComponent(
    `/afiliado ${phone}`
  )}`;
  const text = `*\u{1F464} Sistema de Afiliados:*

${bot?.textAffiliateds}

*\u{1F517} Link:* ${linkAffiliated}

*Usu\xE1rios Afiliados:*
` + affiliateds2.text;
  await client.sendText(data.chatId, text, {
    linkPreview: false
  });
}

// src/events/buttons.ts
var import_util2 = require("util");
var previouslySelected = {};
var buttons = {
  "\u{1F4B8} Adicionar Saldo": addBalance,
  "\u{1F6CD}\uFE0F Logins": showLogins,
  "\u{1F464} Informa\xE7\xF5es": infoUser,
  "\u{1F198} Suporte": support,
  "\u{1F468}\u200D\u{1F4BB} Criador": creator,
  "\u{1F9FE} Hist\xF3rico de Logins": loginsHistory,
  "\u{1FAC2} Afiliados": affiliateds
};
async function onPollResponse(client, data) {
  if (data.msgId.fromMe !== true)
    return;
  for (const field of ["sender", "chatId"]) {
    if (!data[field].endsWith("@lid"))
      continue;
    const entry = await client.getPnLidEntry(data[field]);
    if (entry.phoneNumber?._serialized)
      data[field] = entry.phoneNumber._serialized;
  }
  const selected = parserPollResponse(data, client.wid || "");
  data.selected = selected;
  const added = selected.added;
  if (added === void 0)
    return;
  try {
    if (added === TELEGRAM_STORE_OPTION || added === TELEGRAM_HELP_OPTION) {
      if (data.chatId !== data.sender)
        return;
      await handleTelegram(client, { from: data.sender, body: added === TELEGRAM_STORE_OPTION ? "/loja" : "/ajudavinculo" });
      if (added === TELEGRAM_STORE_OPTION) {
        const message = { from: data.sender };
        if (await initialSettings(client, message, false))
          await menu(client, message);
      }
      return;
    }
    if (added === "\u{1F9FE} Hist\xF3rico Telegram") {
      if (data.chatId !== data.sender)
        return;
      await handleTelegram(client, { from: data.sender, body: "/historicotelegram" });
      return;
    }
    if (added === "\u{1F517} Telegram") {
      await handleTelegram(client, { from: data.chatId, body: "/telegram" });
      return;
    }
    const button = buttons[added];
    if (button) {
      await button(client, data);
      return;
    }
    await responseBuyLogin(client, data);
  } catch (error) {
    console.log(error);
    await client.sendText(data.chatId, "Ocorreu um erro ao processar sua mensagem. Tente novamente ou entre em contato com o suporte.");
    const text = `*ERROR Button*

User: wa.me/${data.sender.replace(/\D/g, "")}
Chat: ${data.chatId}
Bot\xE3o: ${data.selected.added}


${(0, import_util2.inspect)(error)}`;
    notifyOwner(client, text);
  }
}
function parserPollResponse(data, botWid) {
  const key2 = `${botWid}:${data.sender}:${data.msgId.id}`;
  const prevSelected = previouslySelected[key2] || [];
  const newSelected = data.selectedOptions.filter((item) => item !== null).map((item) => item.name);
  const added = newSelected.filter((item) => !prevSelected.includes(item))?.[0];
  const removed = prevSelected.filter((item) => !newSelected.includes(item))?.[0];
  previouslySelected[key2] = newSelected;
  return {
    added,
    removed
  };
}

// src/events/message.ts
var import_client9 = require("@prisma/client");

// src/commands/reconnectBot.ts
var import_client5 = require("@prisma/client");
var import_qr_image = __toESM(require("qr-image"));
var import_fs3 = require("fs");
var prisma5 = new import_client5.PrismaClient();
async function commandReconnectBot(client, message, command) {
  const [phoneBot] = command.args;
  if (!phoneBot) {
    client.sendText(
      message.from,
      "Forma de uso: /reconnect [NUMERO DO BOT]\n\nExemplo: /reconnect 5511999999999"
    );
    return;
  }
  const bot = await prisma5.bot.findUnique({
    where: {
      wid: `${phoneBot}@c.us`
    }
  });
  if (!bot) {
    client.sendText(message.from, `Bot *${phoneBot}* n\xE3o encontrado!`);
    return;
  }
  if (!clients[bot.wid]) {
    await client.sendText(
      message.from,
      "Inst\xE2ncia do bot n\xE3o encontrada. Criando uma nova...",
      {
        quotedMsg: message.id
      }
    );
    let qrcodeSended = false;
    clients[bot.wid] = await createBot(bot, {
      catchQR: async (base64Qrimg, asciiQR, attempt, urlCode) => {
        if (qrcodeSended)
          return;
        const png = import_qr_image.default.imageSync(urlCode, { type: "png" });
        let base64 = Buffer.from(png).toString("base64");
        base64 = `data:image/png;base64,${base64}`;
        await client.sendImageFromBase64(
          message.from,
          base64,
          "qr_code",
          "Leia o QR Code para iniciar a sess\xE3o!"
        );
        qrcodeSended = true;
      },
      statusFind: (status) => {
        if (status === "qrReadError" || status === "qrReadFail") {
          client.sendText(message.from, "Erro ao ler o QR Code, tente novamente!");
        }
      }
    });
    handler(clients[bot.wid]);
    notifyAdmin(
      client,
      `Admin ${message.author || message.from} est\xE1 reconectando o bot *${phoneBot}*`
    );
    return;
  }
  await client.sendText(message.from, "Reconectando bot, aguarde...", {
    quotedMsg: message.id
  });
  await clients[bot.wid].logout();
  (0, import_fs3.rmdirSync)(`./tokens/${bot.name}`, { recursive: true });
  clients[bot.wid] = await createBot(bot, {
    catchQR: async (base64Qrimg, asciiQR, attempt, urlCode) => {
      const png = import_qr_image.default.imageSync(urlCode, { type: "png" });
      let base64 = Buffer.from(png).toString("base64");
      base64 = `data:image/png;base64,${base64}`;
      await client.sendImageFromBase64(
        message.from,
        base64,
        "qr_code",
        "Leia o QR Code para iniciar a sess\xE3o!"
      );
    },
    statusFind: (status) => {
      if (status === "qrReadError" || status === "qrReadFail") {
        client.sendText(message.from, "Erro ao ler o QR Code, tente novamente!");
      }
    }
  });
  handler(clients[bot.wid]);
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} est\xE1 reconectando o bot *${phoneBot}*`
  );
}

// src/commands/addStock.ts
var import_client6 = require("@prisma/client");
var prisma6 = new import_client6.PrismaClient();
async function commandAddStock(client, message, command) {
  const [name, ...lines] = command.args.join(" ").split(/\r?\n/);
  const logins = lines.map((line) => {
    const [user, password, ...rest] = line.split(/\||:/);
    const additional = rest.join(" ");
    return { user, password, additional };
  }).filter((login) => login.user && login.password);
  if (!name && logins.length === 0) {
    client.sendText(
      message.from,
      "Nenhum login foi informado\n\nExemplo: /add Netflix\ntest|12345|adicional\ntest2|12345|adicional",
      {
        quotedMsg: message.id
      }
    );
    return;
  }
  const count = {
    success: 0,
    error: 0
  };
  for (const { user, password, additional } of logins) {
    const stocks = await prisma6.logins.create({
      data: {
        name,
        user,
        password,
        additional,
        bot: {
          connect: {
            wid: client.wid
          }
        },
        setting: {
          connectOrCreate: {
            where: {
              name
            },
            create: {
              name,
              bot: {
                connect: {
                  wid: client.wid
                }
              }
            }
          }
        }
      }
    });
    if (stocks) {
      count.success++;
    } else {
      count.error++;
    }
  }
  client.sendText(message.from, `Foram adicionados ${count.success} logins e ${count.error} falharam`);
  await notifyAdmin(client, `Foram adicionados ${count.success} logins e ${count.error} falharam`);
}

// src/commands/affiliated.ts
async function commandAffiliated(client, message, command) {
  const phone = command.args.join(" ").replace(/\D/g, "");
  if (!phone) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar um n\xFAmero de telefone do seu afiliado. Exemplo: /afiliado 5511999999999"
    );
    return;
  }
  const affiliator = await prisma_default.user.findFirst({
    where: {
      wid: `${phone}@c.us`,
      bot: {
        wid: client.wid
      }
    }
  });
  if (affiliator === null) {
    client.sendText(message.from, "Este usu\xE1rio n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  const widSender = message.author || message.from;
  if (widSender === affiliator.wid) {
    client.sendText(message.from, "Voc\xEA n\xE3o pode se afiliar a si mesmo.");
    return;
  }
  const userSender = await prisma_default.user.findFirst({
    where: {
      wid: widSender,
      bot: {
        wid: client.wid
      }
    }
  });
  if (userSender === null) {
    client.sendText(message.from, "Voc\xEA n\xE3o est\xE1 cadastrado no sistema.");
    return;
  }
  if (userSender.affiliated !== "") {
    client.sendText(message.from, "Voc\xEA j\xE1 est\xE1 afiliado a um usu\xE1rio.");
    return;
  }
  await prisma_default.user.update({
    where: {
      id: affiliator.id
    },
    data: {
      affiliateds: {
        create: {
          wid: userSender.wid,
          bot: {
            connect: {
              wid: client.wid
            }
          }
        }
      }
    }
  });
  await prisma_default.user.update({
    where: {
      id: userSender.id
    },
    data: {
      affiliated: affiliator.wid
    }
  });
  await client.sendText(
    message.from,
    `Voc\xEA foi afiliado com sucesso ao usu\xE1rio @${affiliator.wid.replace(/\D/g, "")}`,
    {
      mentionedList: [affiliator.wid]
    }
  );
  client.sendText(
    affiliator.wid,
    `O usu\xE1rio @${userSender.wid.replace(/\D/g, "")} foi afiliado a voc\xEA.`,
    {
      mentionedList: [userSender.wid]
    }
  );
}

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
var import_qr_image2 = __toESM(require("qr-image"));
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
  const png = import_qr_image2.default.imageSync(res.response?.qrcode, { type: "png" });
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

// src/commands/price.ts
var import_client7 = require("@prisma/client");
var prisma7 = new import_client7.PrismaClient();
async function commandDefinePrice(client, message, command) {
  const [name, price] = command.args.join(" ").split(/\|/).map((value) => value.trim());
  if (!name || !price) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o nome e o pre\xE7o do produto. Exemplo: /price Netflix|10"
    );
    return;
  }
  const bot = await prisma7.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (bot === null) {
    client.sendText(message.from, "O bot n\xE3o est\xE1 configurado.");
    return;
  }
  const product = await prisma7.loginsSettings.findUnique({
    where: {
      name
    }
  });
  if (product === null || product.botId !== bot.id) {
    client.sendText(message.from, "O produto n\xE3o est\xE1 cadastrado.");
    return;
  }
  const priceNumber = Number(price.replace(",", "."));
  if (!Number.isFinite(priceNumber) || priceNumber <= 0 || Math.abs(priceNumber * 100 - Math.round(priceNumber * 100)) > 1e-6) {
    client.sendText(message.from, "O pre\xE7o precisa ser maior que zero e ter no m\xE1ximo duas casas decimais.");
    return;
  }
  await prisma7.loginsSettings.update({
    where: {
      name
    },
    data: {
      price: priceNumber
    }
  });
  await client.sendText(
    message.from,
    `O pre\xE7o do produto ${name} foi alterado para R$ ${priceNumber.toFixed(2)}.`
  );
  notifyAdmin(client, `Admin *${message.author || message.from}* alterou o pre\xE7o do produto *${name}* para *R$ ${priceNumber.toFixed(2)}*.`);
}

// src/commands/text.ts
var menus = {
  inicial: "textMenu",
  pix: "textPix",
  suporte: "textSupport",
  login: "textLogin",
  pixmanual: "textPixManual",
  afiliados: "textAffiliateds"
};
async function commandDefineText(client, message, command) {
  const [menu2, ...textArg] = command.args.join(" ").split(/\n/);
  const text = textArg.join("\n");
  if (!menu2 || !text) {
    const str = `Voc\xEA precisa informar o nome do menu e o texto.

Menus dispon\xEDveis:
\`\`\`${Object.keys(menus).join("\n")}\`\`\`

Modo de uso: /text [NOME DO MENU]
[TEXTO DO MENU]

Exemplo: /text inicial
Ol\xE1, seja bem vindo ao nosso bot!`;
    client.sendText(message.from, str);
    return;
  }
  const menuName = menu2.toLowerCase();
  const menuKey = menus[menuName];
  if (!menuKey) {
    client.sendText(
      message.from,
      `O menu *${menuName}* n\xE3o est\xE1 cadastrado. Os menus cadastrados s\xE3o: ${Object.keys(
        menus
      ).join(", ")}`
    );
    return;
  }
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      [menuKey]: text
    }
  });
  await client.sendText(message.from, `O menu *${menuName}* foi atualizado com sucesso.`);
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} atualizou o texto do menu *${menuName}*
Texto:
${text}`
  );
}

// src/commands/pixMinMax.ts
async function commandDefinePix(client, message, command) {
  const [min, max] = command.args;
  if (!min || !max) {
    client.sendText(message.from, "Voc\xEA precisa informar o valor m\xEDnimo e m\xE1ximo.\n\nExemplo: /pixvalor 3 100");
    return;
  }
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      pixMin: Number(min),
      pixMax: Number(max)
    }
  });
  await client.sendText(message.from, `O valor m\xEDnimo e m\xE1ximo do PIX foi atualizado com sucesso

Valor m\xEDnimo: *${min}*
Valor m\xE1ximo: *${max}*`);
  notifyAdmin(client, `Admin ${message.author || message.from} atualizou o valor m\xEDnimo e m\xE1ximo do PIX

Valor m\xEDnimo: *${min}*
Valor m\xE1ximo: *${max}*`);
}

// src/commands/id.ts
async function commandID(client, message) {
  client.sendText(message.from, `ID: ${message.from}`);
}

// src/commands/gift.ts
async function commandGift(client, message, command) {
  const [amountStr] = command.args;
  const amount = Number(amountStr);
  if (Number.isNaN(amount)) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o valor do gift.\n\nExemplo: /gift 10"
    );
    return;
  }
  const code = (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)).toUpperCase();
  await prisma_default.gifts.create({
    data: {
      code,
      amount,
      bot: {
        connect: {
          wid: client.wid
        }
      }
    }
  });
  await client.sendText(
    message.from,
    `Gift criado com sucesso.

Valor: *R$ ${amount}*

Use: */resgatar ${code}*`
  );
  await client.sendText(message.from, `/resgatar ${code}`);
  notifyAdmin(client, `Admin *${message.author || message.from}* criou um gift

Valor: *R$ ${amount}*
C\xF3digo: *${code}*`);
}

// src/commands/redeem.ts
async function commandRedeem(client, message, command) {
  const account = await loadTelegramSummary(client.wid, message.from);
  if (account.state !== "unlinked") {
    await client.sendText(message.from, account.state === "linked" ? "Sua conta usa o saldo \xFAnico do Telegram. Resgate o gift no Telegram/site para que o cr\xE9dito apare\xE7a tamb\xE9m aqui." : "N\xE3o foi poss\xEDvel consultar o saldo compartilhado. Tente novamente mais tarde.");
    return;
  }
  const [code] = command.args;
  if (!code) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o c\xF3digo do gift.\n\nExemplo: /resgatar ABC123"
    );
    return;
  }
  const gift = await prisma_default.gifts.findUnique({
    where: {
      code,
      bot: {
        wid: client.wid
      }
    }
  });
  if (gift === null) {
    client.sendText(message.from, "Este gift n\xE3o existe.");
    return;
  }
  if (gift.redeemed) {
    client.sendText(message.from, "Este gift j\xE1 foi resgatado.");
    return;
  }
  let user = await prisma_default.user.findFirst({
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
  user = await prisma_default.user.update({
    where: {
      id: user.id
    },
    data: {
      balance: {
        increment: gift.amount
      }
    }
  });
  await prisma_default.gifts.update({
    where: {
      id: gift.id
    },
    data: {
      redeemed: true,
      redeemedAt: /* @__PURE__ */ new Date()
    }
  });
  await client.sendImage(
    message.from,
    "./assets/gift.jpeg",
    "gift.jpeg",
    `Gift resgatado com sucesso.

Valor: *R$ ${gift.amount}*
Saldo atual: *R$ ${user.balance}*`
  );
  notifyAdmin(
    client,
    `Usu\xE1rio ${message.author || message.from} resgatou um gift.

Valor: *R$ ${gift.amount}*
Saldo atual: *R$ ${user.balance}*`
  );
}

// src/commands/adm.ts
async function commandAdmin(client, message) {
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    },
    include: {
      admins: {
        select: {
          wid: true
        }
      },
      _count: {
        select: {
          users: true,
          loginsHistory: true,
          logins: true
        }
      },
      pixHistory: true,
      gifts: {
        where: {
          redeemed: true
        }
      }
    }
  });
  if (!bot)
    return;
  const textOwner = "*/newbot* - Cria um novo bot\n*/reconnect* - Reconecta um bot\n*/block* - Bloqueia e desbloqueia um bot\n*/tokenmpmaster* - Define o token do Mercado Pago Master\n*/precosemanal* - Define o pre\xE7o semanal\n*/removerbot* - Remove um bot\n*/bots* - Listar todos os bots\n\n";
  const owners = process.env.OWNER_PHONE?.split(",")?.map((owner) => `${owner.trim()}@c.us`) || [];
  const isOwner = owners.includes(message.author || message.from);
  const listAdmins = bot.admins.map(({ wid }) => wid.replace(/\D/g, "")).join(", ");
  const pixToday = bot.pixHistory.filter((pix) => {
    const date = /* @__PURE__ */ new Date();
    date.setHours(0, 0, 0, 0);
    return pix.createAt >= date;
  }).reduce((acc, { amount }) => acc + amount, 0);
  const pixWeek = bot.pixHistory.filter((pix) => {
    const date = /* @__PURE__ */ new Date();
    date.setDate(date.getDate() - 7);
    date.setHours(0, 0, 0, 0);
    return pix.createAt >= date;
  }).reduce((acc, { amount }) => acc + amount, 0);
  const pixMonth = bot.pixHistory.filter((pix) => {
    const date = /* @__PURE__ */ new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return pix.createAt >= date;
  }).reduce((acc, { amount }) => acc + amount, 0);
  const pixTotal = bot.pixHistory.reduce((acc, { amount }) => acc + amount, 0);
  const largerPix = bot.pixHistory.reduce((acc, { amount }) => Math.max(acc, amount), 0);
  const giftTotal = bot.gifts.reduce((acc, { amount }) => acc + amount, 0);
  const largerGift = bot.gifts.reduce((acc, { amount }) => Math.max(acc, amount), 0);
  const text = `*Painel Admin*

*Dono:* ${bot.owner.replace(/\D/g, "")}
*Lista de Admins:* ${listAdmins}

*Data de expira\xE7\xE3o:* ${bot.expireAt.toLocaleString("pt-BR")}

*PIX:*
*Tipo do PIX:* ${bot.pixType}
*Token Mercado Pago:* ${bot.mercadoPagoToken || "SEM TOKEN"}
*Chave Pix Manual:* ${bot.pixManualKey}
*Informa\xE7\xF5es Adicional Pix Manual:* ${bot.pixManualAdditional}
*PIX de Hoje:* R$ ${pixToday.toFixed(2)}
*PIX da Semana:* R$ ${pixWeek.toFixed(2)}
*PIX do M\xEAs:* R$ ${pixMonth.toFixed(2)}
*PIX Total:* R$ ${pixTotal.toFixed(2)}
*Maior PIX Inserido:* R$ ${largerPix.toFixed(2)}

*Usu\xE1rios Registrados:* ${bot._count.users}

*Logins no estoque:* ${bot._count.logins}
*Logins vendidos:* ${bot._count.loginsHistory}

*Gifts Resgatados:* R$ ${giftTotal.toFixed(2)}
*Maior Gift Resgatado:* R$ ${largerGift.toFixed(2)}

*Comandos Administrativos:*
( _Para saber mais sobre um comando, apenas execute o mesmo._ )

${isOwner ? textOwner : ""}*/add* - Adiciona estoque de logins
*/text* - Define o texto de um menu
*/pixvalor* - Define o valor m\xEDnimo e m\xE1ximo do PIX
*/notificacao* - Ativa ou desativa as notifica\xE7\xF5es
*/gift* - Cria um gift
*/addadmin* - Adiciona um administrador
*/removeradmin* - Remove um administrador
*/id* - Mostra o ID do chat
*/preco* - Define o pre\xE7o de um login
*/tokenmp* - Define o token do Mercado Pago
*/pixtipo* - Define o tipo de PIX(manual ou automatico)
*/pixmanual* - Define a chave do PIX manual
*/spam* - Envia uma mensagem para todos os usu\xE1rios
*/removerstock* - Remove um estoque de logins
*/definirsaldo* - Define o saldo de um usu\xE1rio
*/renovar* - Renovar aluguel do bot
*/adduser* - Adiciona usu\xE1rios para fazer spam
*/saldodobro* - Define o saldo em dobro a cada pix
*/bonus* - Define o valor do b\xF4nus usuario novato
*/manutencao* - Ativa ou desativa a manuten\xE7\xE3o
*/notificacoesfake* - Ativa ou desativa as notifica\xE7\xF5es de vendas fake
*/loginimg* - Define a imagem de um login
*/logintext* - Define o texto de um login`;
  client.sendText(message.from, text);
}

// src/commands/addAdmin.ts
async function commandAddAdmin(client, message, command) {
  const number = command.args.join(" ").replace(/\D/g, "");
  if (!number) {
    client.sendText(
      message.from,
      "N\xFAmero invalido ou n\xE3o informado. Use: /addadmin 5511999999999"
    );
    return;
  }
  const admin = await prisma_default.admins.findFirst({
    where: {
      wid: `${number}@c.us`,
      bot: {
        wid: client.wid
      }
    }
  });
  if (admin) {
    client.sendText(message.from, `O n\xFAmero *${number}* j\xE1 \xE9 um administrador.`);
    return;
  }
  await prisma_default.admins.create({
    data: {
      wid: `${number}@c.us`,
      bot: {
        connect: {
          wid: client.wid
        }
      }
    }
  });
  client.sendText(message.from, `O n\xFAmero *${number}* foi adicionado como administrador.`);
  notifyAdmin(client, `O n\xFAmero *${number}* foi adicionado como administrador.`);
}

// src/commands/removeAdmin.ts
async function commandRemoveAdmin(client, message, command) {
  const number = command.args.join("").replace(/\D/g, "");
  if (!number) {
    client.sendText(
      message.from,
      "N\xFAmero invalido ou n\xE3o informado. Use: /removeradmin 5511999999999"
    );
    return;
  }
  const admin = await prisma_default.admins.findFirst({
    where: {
      wid: `${number}@c.us`,
      bot: {
        wid: client.wid
      }
    }
  });
  if (!admin) {
    client.sendText(message.from, `O n\xFAmero *${number}* n\xE3o \xE9 um administrador.`);
    return;
  }
  await prisma_default.admins.delete({
    where: {
      id: admin.id,
      bot: {
        wid: client.wid
      }
    }
  });
  await client.sendText(message.from, `O n\xFAmero *${number}* foi removido como administrador.`);
  notifyAdmin(client, `Admin ${message.author || message.from} removeu o n\xFAmero *${number}* como administrador.`);
}

// src/commands/tokenMP.ts
async function commandTokenMP(client, message, command) {
  const tokenMp = command.args.join(" ");
  if (!tokenMp) {
    client.sendText(message.from, "Voc\xEA precisa informar o token do Mercado Pago.\n\nExemplo: /tokenMP 1234567890");
    return;
  }
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      mercadoPagoToken: tokenMp
    }
  });
  await client.sendText(message.from, `Token do Mercado Pago atualizado com sucesso

Token: *${tokenMp}*`);
  notifyAdmin(client, `Admin ${message.author || message.from} atualizou o token do Mercado Pago

Token: *${tokenMp}*`);
}

// src/commands/pixType.ts
async function commandPixType(client, message, command) {
  let [type] = command.args;
  if (type !== "auto" && type !== "manual" && type !== "automatico") {
    client.sendText(
      message.from,
      'Voc\xEA precisa informar o tipo de pix, "auto" ou "manual". Exemplo: /pixtipe manual'
    );
    return;
  }
  type = type === "automatico" ? "auto" : type;
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      pixType: type
    }
  });
  await client.sendText(message.from, `Tipo de pix alterado para "${type}"`);
  notifyAdmin(client, `Admin ${message.author || message.from} alterou o tipo de pix para "${type}"`);
}

// src/commands/pixManual.ts
async function commandPixManual(client, message, command) {
  const [key2, additional] = command.args.join(" ").split("|");
  if (!key2) {
    client.sendText(message.from, "Voc\xEA precisa informar a chave pix e caso queira colocar alguma informa\xE7\xE3o adicional.\n\nExemplo: /pixmanual 1234567890|Informa\xE7\xE3o adicional");
    return;
  }
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      pixManualKey: key2,
      pixManualAdditional: additional
    }
  });
  await client.sendText(message.from, `Chave pix manual atualizada com sucesso

Chave: *${key2}*
Informa\xE7\xE3o adicional: *${additional}*`);
  notifyAdmin(client, `Admin ${message.author || message.from} atualizou a chave pix manual

Chave: *${key2}*
Informa\xE7\xE3o adicional: *${additional}*`);
}

// src/commands/spam.ts
var import_fs4 = require("fs");
async function commandSpam(client, message, command) {
  const text = command.args.join(" ");
  if (!text) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o texto que deseja enviar. Use: /spam texto"
    );
    return;
  }
  const users = await prisma_default.user.findMany({
    where: {
      bot: {
        wid: client.wid
      }
    },
    select: {
      wid: true
    }
  });
  if (users.length === 0) {
    client.sendText(message.from, "Nenhum usu\xE1rio encontrado.");
    return;
  }
  await client.sendText(message.from, `Enviando mensagem para ${users.length} usu\xE1rios...`);
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} est\xE1 fazendo spam para ${users.length} usu\xE1rios...`
  );
  let filename;
  if (message.type === "image") {
    const response = await client.downloadMedia(message);
    const base64Data = response.replace(/data:image\/.+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    filename = `./assets/${Date.now()}.jpg`;
    (0, import_fs4.writeFileSync)(filename, buffer);
  }
  let count = 0;
  for (const user of users) {
    try {
      if (filename) {
        await client.sendImage(user.wid, filename, "image.jpg", text);
      } else {
        await client.sendText(user.wid, text);
      }
      count++;
    } catch (error) {
      console.error(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1e4));
  }
  if (filename)
    (0, import_fs4.rmSync)(filename);
  client.sendText(message.from, `Mensagem enviada para ${count} usu\xE1rios com sucesso.`);
}

// src/commands/removeStock.ts
var import_client8 = require("@prisma/client");
var prisma8 = new import_client8.PrismaClient();
async function commandRemoveStock(client, message, command) {
  const [name] = command.args;
  if (!name) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o nome do produto que deseja remover. Exemplo: /removerstock Netflix",
      {
        quotedMsg: message.id
      }
    );
    return;
  }
  const { count } = await prisma8.logins.deleteMany({
    where: {
      bot: {
        wid: client.wid
      },
      name
    }
  });
  if (count === 0) {
    client.sendText(message.from, "O produto n\xE3o est\xE1 cadastrado.", {
      quotedMsg: message.id
    });
    return;
  }
  await client.sendText(message.from, `Foram removidos ${count} logins do produto "${name}".`, {
    quotedMsg: message.id
  });
  notifyAdmin(client, `Admin ${message.author || message.from} removeu ${count} logins do produto "${name}".`);
}

// src/commands/defineBalance.ts
async function commandDefineBalance(client, message, command) {
  const [_number, _amount] = command.args.join(" ").split("|");
  const number = _number?.replace(/\D/g, "");
  const amount = Number(_amount?.replace(/[^\d.]/g, "") || NaN);
  if (!number || Number.isNaN(amount)) {
    client.sendText(
      message.from,
      "N\xFAmero ou valor invalido ou n\xE3o informado. Use: */definirsaldo 5511999999999|100*"
    );
    return;
  }
  const account = await loadTelegramSummary(client.wid, `${number}@c.us`);
  if (account.state !== "unlinked") {
    await client.sendText(message.from, account.state === "linked" ? "Cliente vinculado: altere o saldo no painel/Telegram. A altera\xE7\xE3o aparecer\xE1 automaticamente no WhatsApp." : "Consulta de saldo compartilhado indispon\xEDvel. Nenhum saldo foi alterado.");
    return;
  }
  const user = await prisma_default.user.findFirst({
    where: {
      wid: `${number}@c.us`,
      bot: {
        wid: client.wid
      }
    }
  });
  if (!user) {
    client.sendText(message.from, "Usu\xE1rio n\xE3o encontrado.");
    return;
  }
  await prisma_default.user.update({
    where: {
      id: user.id
    },
    data: {
      balance: amount
    }
  });
  await client.sendText(
    message.from,
    `O saldo do usu\xE1rio ${number} foi definido para R$ ${amount.toFixed(2)}`
  );
  notifyAdmin(client, `O saldo do usu\xE1rio ${number} foi definido para R$ ${amount.toFixed(2)}`);
}

// src/commands/menu.ts
async function commandMenu(client, message) {
  await menu(client, message);
}

// src/commands/renew.ts
var import_qr_image3 = __toESM(require("qr-image"));
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
  const png = import_qr_image3.default.imageSync(res.response?.qrcode, { type: "png" });
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

// src/commands/tokenMpOwner.ts
async function commandTokenMPMaster(client, message, command) {
  const tokenMp = command.args.join(" ");
  if (client.wid?.replace(/\D/g, "") !== process.env.BOT_PHONE) {
    client.sendText(message.from, "Bot n\xE3o \xE9 o principal.");
    return;
  }
  if (!tokenMp) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o token do Mercado Pago.\n\nExemplo: /tokenmpmaster 1234567890"
    );
    return;
  }
  await prisma_default.botMaster.update({
    where: {
      wid: client.wid
    },
    data: {
      mercadoPagoToken: tokenMp
    }
  });
  await client.sendText(
    message.from,
    `Token do Mercado Pago atualizado com sucesso

Token: *${tokenMp}*`
  );
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} atualizou o token do Mercado Pago do bot master

Token: *${tokenMp}*`
  );
}

// src/commands/priceWeek.ts
async function commandPriceWeek(client, message, command) {
  const _amount = command.args.join(" ");
  const amount = Number(_amount);
  if (client.wid?.replace(/\D/g, "") !== process.env.BOT_PHONE) {
    client.sendText(message.from, "Bot n\xE3o \xE9 o principal.");
    return;
  }
  if (!amount) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o valor do aluguel semanal dos bots.\n\nExemplo: /precosemana 10"
    );
    return;
  }
  await prisma_default.botMaster.update({
    where: {
      wid: client.wid
    },
    data: {
      priceWeek: amount
    }
  });
  await client.sendText(
    message.from,
    `Valor do aluguel semanal atualizado com sucesso

Valor: *${amount}*`
  );
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} atualizou o valor do aluguel semanal dos bots

Valor: *${amount}*`
  );
}

// src/commands/blockBot.ts
async function commandBlockBot(client, message, command) {
  const phoneBot = command.args.join(" ").replace(/\D/g, "");
  if (!phoneBot) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o n\xFAmero do bot para bloquear ou desbloquear. Exemplo: /block 5511999999999"
    );
    return;
  }
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: `${phoneBot}@c.us`
    }
  });
  if (!bot) {
    client.sendText(message.from, `Bot *${phoneBot}* n\xE3o encontrado!`);
    return;
  }
  await prisma_default.bot.update({
    where: {
      wid: `${phoneBot}@c.us`
    },
    data: {
      block: !bot?.block
    }
  });
  await client.sendText(
    message.from,
    `Bot ${phoneBot} ${bot?.block ? "desbloqueado" : "bloqueado"} com sucesso.`
  );
  notifyAdmin(
    client,
    `Dono ${message.author || message.from} ${bot?.block ? "desbloqueou" : "bloqueou"} o bot ${phoneBot}`
  );
}

// src/commands/bots.ts
async function commandShowBots(client, message) {
  const bots = await prisma_default.bot.findMany({
    select: {
      wid: true,
      owner: true,
      expireAt: true,
      name: true,
      admins: {
        select: {
          wid: true
        }
      },
      _count: {
        select: {
          users: true
        }
      }
    }
  });
  let text = "*Lista de Todos os Bots:*\n\n";
  for (const bot of bots) {
    const admins = bot.admins.map(({ wid }) => wid.replace(/\D/g, "")).join(", ");
    text += `*Nome:* ${bot.name}
*N\xFAmero:* ${bot.wid.replace(/\D/g, "")}
*Dono:* ${bot.owner.replace(/\D/g, "")}
*Expira em:* ${bot.expireAt?.toLocaleString()}
*Usu\xE1rios:* ${bot._count.users}
*Admins:* ${admins}

`;
  }
  client.sendText(message.from, text.trim());
}

// src/commands/addusers.ts
async function commandAddUsers(client, message, command) {
  const numbers = command.args.join(" ").split(/\r?\n/).map((number) => number.replace(/\D/g, "")).filter(Boolean);
  if (numbers.length === 0) {
    await client.sendText(
      message.from,
      "Voc\xEA precisa informar os n\xFAmeros. Exemplo: /addusers 5511999999999\n5511888888888\n5511777777777"
    );
    return;
  }
  let count = 0;
  for (const number of numbers) {
    try {
      await prisma_default.user.create({
        data: {
          wid: number,
          bot: {
            connect: {
              wid: client.wid
            }
          }
        }
      });
      count++;
    } catch (error) {
      console.log(error.message);
    }
  }
  await client.sendText(
    message.from,
    `Foram adicionados ${count} usu\xE1rios com sucesso, e ${numbers.length - count} falharam.`
  );
  notifyAdmin(
    client,
    `O admin ${message.author || message.from} adicionou ${count} usu\xE1rios com sucesso, e ${numbers.length - count} falharam.`
  );
}

// src/commands/doubleBalance.ts
async function commandDoubleBalance(client, message) {
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (!bot) {
    throw new Error("Bot not found");
  }
  const doubleBalance = !bot.doubleBalance;
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      doubleBalance
    }
  });
  await client.sendText(
    message.from,
    `O modo de *Saldo em Dobro* foi ${doubleBalance ? "ativado" : "desativado"} com sucesso.`
  );
  notifyAdmin(
    client,
    `O modo de *Saldo em Dobro* foi ${doubleBalance ? "ativado" : "desativado"} por *${message.author || message.from}*`
  );
}

// src/commands/bonus.ts
async function commandDefineBonus(client, message, command) {
  const arg = command.args?.[0]?.replace(/[^\d.]/g, "");
  const amount = Number(arg);
  if (!arg || isNaN(amount) || amount < 0) {
    client.sendText(
      message.from,
      "Voc\xEA precisa informar o valor do bon\xFAs. Para desativar deixe o valor como *0*. Exemplo: */bonus 10*"
    );
    return;
  }
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      bonus: amount
    }
  });
  await client.sendText(message.from, `O valor do bon\xFAs foi atualizado para *${amount}*.`);
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} atualizou o valor do bon\xFAs para *${amount}*.`
  );
}

// src/commands/fakeNotify.ts
async function commandFakeNotify(client, message) {
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (!bot) {
    throw new Error("Bot not found");
  }
  const fakeNotify2 = !bot.fakeNotify;
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      fakeNotify: fakeNotify2
    }
  });
  await client.sendText(
    message.from,
    `O modo de *Notifica\xE7\xF5es Fake* foi ${fakeNotify2 ? "ativado" : "desativado"} com sucesso.`
  );
  notifyAdmin(
    client,
    `O modo de *Notifica\xE7\xF5es Fake* foi ${fakeNotify2 ? "ativado" : "desativado"} por *${message.author || message.from}*`
  );
}

// src/commands/maintenance.ts
async function commandMaintenance(client, message) {
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (!bot) {
    throw new Error("Bot not found");
  }
  const maintenance = !bot.maintenance;
  await prisma_default.bot.update({
    where: {
      wid: client.wid
    },
    data: {
      maintenance
    }
  });
  await client.sendText(
    message.from,
    `O modo de *Manuten\xE7\xE3o* foi ${maintenance ? "ativado" : "desativado"} com sucesso.`
  );
  notifyAdmin(
    client,
    `O modo de *Manuten\xE7\xE3o* foi ${maintenance ? "ativado" : "desativado"} por *${message.author || message.from}*`
  );
}

// src/commands/removeBot.ts
var import_fs5 = require("fs");
async function commandRemoveBot(client, message, command) {
  const [phoneBot] = command.args;
  if (!phoneBot) {
    client.sendText(
      message.from,
      "Forma de uso: /removerbot [NUMERO DO BOT]\n\nExemplo: /removerbot 5511999999999"
    );
    return;
  }
  const bot = await prisma_default.bot.findUnique({
    where: {
      wid: `${phoneBot}@c.us`
    }
  });
  if (!bot) {
    client.sendText(message.from, `Bot *${phoneBot}* n\xE3o encontrado!`);
    return;
  }
  await prisma_default.bot.delete({
    where: {
      id: bot.id
    }
  });
  clients[bot.wid]?.close();
  delete clients[bot.wid];
  (0, import_fs5.rmdirSync)(`./tokens/${bot.name}`, { recursive: true });
  await client.sendText(message.from, `Bot *${phoneBot}* removido com sucesso.`);
}

// src/commands/imageLogin.ts
async function commandImageLogin(client, message, command) {
  const args = command.args.join(" ");
  if (message.type !== "image") {
    await client.sendText(
      message.from,
      "Use /loginimg [NOME DO LOGIN] na legenda de uma imagem!"
    );
    return;
  }
  if (!args) {
    await client.sendText(
      message.from,
      "Use /loginimg [NOME DO LOGIN] na legenda de uma imagem!"
    );
    return;
  }
  const login = await prisma_default.loginsSettings.findFirst({
    where: {
      name: args,
      bot: {
        wid: client.wid
      }
    }
  });
  if (!login) {
    await client.sendText(message.from, "Login n\xE3o encontrado!");
    return;
  }
  const response = await client.downloadMedia(message);
  const base64Data = response.replace(/data:image\/.+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  await prisma_default.loginsSettings.update({
    where: {
      id: login.id,
      bot: {
        wid: client.wid
      }
    },
    data: {
      image: buffer
    }
  });
  await client.sendText(message.from, `Image do login *${login.name}* atualizada com sucesso!`);
  notifyAdmin(client, `Admin ${message.author || message.from} atualizou a imagem do login *${login.name}*`);
}

// src/commands/textLogin.ts
async function commandDefineTextLogin(client, message, command) {
  const [loginName, ...textArg] = command.args.join(" ").split(/\n/);
  const text = textArg.join("\n");
  if (!loginName || !text) {
    const str = "Voc\xEA precisa informar o nome do login e o texto.\n\nModo de uso: /logintext [NOME DO LOGIN]\n[TEXTO]\n\nExemplo: /logintext Netflix\nBela compra, obrigado!";
    client.sendText(message.from, str);
    return;
  }
  const login = await prisma_default.loginsSettings.findFirst({
    where: {
      name: loginName,
      bot: {
        wid: client.wid
      }
    }
  });
  if (!login) {
    client.sendText(message.from, "Login n\xE3o encontrado.");
    return;
  }
  await prisma_default.loginsSettings.update({
    where: {
      id: login.id,
      bot: {
        wid: client.wid
      }
    },
    data: {
      text
    }
  });
  await client.sendText(message.from, `O texto do login *${login.name}* foi atualizado com sucesso.`);
  notifyAdmin(
    client,
    `Admin ${message.author || message.from} atualizou o texto do login *${login.name}*
Texto:
${text}`
  );
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

// src/events/commands.ts
var commands = [
  { alias: ["apiprodutos"], handler: commandApiProducts, permissions: ["ADM"] },
  { alias: ["apipedido"], handler: commandApiOrder },
  { alias: ["apipedidos"], handler: commandApiOrders, permissions: ["ADM"] },
  { alias: ["apiestornar"], handler: commandApiRefund, permissions: ["ADM"] },
  {
    alias: ["afiliado"],
    handler: commandAffiliated
  },
  {
    alias: ["pix"],
    handler: commandPix
  },
  {
    alias: ["resgatar"],
    handler: commandRedeem
  },
  {
    alias: ["newbot"],
    handler: commandNewBot,
    permissions: ["OWNER"]
  },
  {
    alias: ["reconnect"],
    handler: commandReconnectBot,
    permissions: ["OWNER"]
  },
  {
    alias: ["add", "addestoque", "addstock"],
    handler: commandAddStock,
    permissions: ["ADM"]
  },
  {
    alias: ["price", "preco", "pre\xE7o"],
    handler: commandDefinePrice,
    permissions: ["ADM"]
  },
  {
    alias: ["notificacoes", "notificacao", "notifica\xE7\xF5es", "notifica\xE7\xE3o"],
    handler: commandDefineNotifySales,
    permissions: ["ADM"]
  },
  {
    alias: ["text"],
    handler: commandDefineText,
    permissions: ["ADM"]
  },
  {
    alias: ["pixvalor"],
    handler: commandDefinePix,
    permissions: ["ADM"]
  },
  {
    alias: ["id"],
    handler: commandID,
    permissions: ["ADM"]
  },
  {
    alias: ["gift"],
    handler: commandGift,
    permissions: ["ADM"]
  },
  {
    alias: ["adm", "admin"],
    handler: commandAdmin,
    permissions: ["ADM"]
  },
  {
    alias: ["addadmin"],
    handler: commandAddAdmin,
    permissions: ["ADM"]
  },
  {
    alias: ["removeradmin"],
    handler: commandRemoveAdmin,
    permissions: ["ADM"]
  },
  {
    alias: ["tokenmp"],
    handler: commandTokenMP,
    permissions: ["ADM"]
  },
  {
    alias: ["pixtipo"],
    handler: commandPixType,
    permissions: ["ADM"]
  },
  {
    alias: ["pixmanual"],
    handler: commandPixManual,
    permissions: ["ADM"]
  },
  {
    alias: ["spam"],
    handler: commandSpam,
    permissions: ["ADM"]
  },
  {
    alias: ["removerstock"],
    handler: commandRemoveStock,
    permissions: ["ADM"]
  },
  {
    alias: ["definirsaldo"],
    handler: commandDefineBalance,
    permissions: ["ADM"]
  },
  {
    alias: ["menu"],
    handler: commandMenu
  },
  {
    alias: ["renovar"],
    handler: commandRenew,
    permissions: ["ADM"]
  },
  {
    alias: ["tokenmpmaster"],
    handler: commandTokenMPMaster,
    permissions: ["OWNER"]
  },
  {
    alias: ["precosemanal", "pre\xE7osemana", "precosemana", "pre\xE7osemanal"],
    handler: commandPriceWeek,
    permissions: ["OWNER"]
  },
  {
    alias: ["block", "bloquear", "desblock", "desbloquear"],
    handler: commandBlockBot,
    permissions: ["OWNER"]
  },
  {
    alias: ["bots"],
    handler: commandShowBots,
    permissions: ["OWNER"]
  },
  {
    alias: ["adduser", "addusers"],
    handler: commandAddUsers,
    permissions: ["ADM"]
  },
  {
    alias: ["saldodobro", "saldoemdobro"],
    handler: commandDoubleBalance,
    permissions: ["ADM"]
  },
  {
    alias: ["bonus"],
    handler: commandDefineBonus,
    permissions: ["ADM"]
  },
  {
    alias: ["notifica\xE7\xF5esfake", "notificacoesfake", "fakenotify"],
    handler: commandFakeNotify,
    permissions: ["ADM"]
  },
  {
    alias: ["manutencao", "manuten\xE7\xE3o"],
    handler: commandMaintenance,
    permissions: ["ADM"]
  },
  {
    alias: ["removerbot", "removebot"],
    handler: commandRemoveBot,
    permissions: ["OWNER"]
  },
  {
    alias: ["loginimg", "imglogin", "loginimagem", "imagemlogin"],
    handler: commandImageLogin,
    permissions: ["ADM"]
  },
  {
    alias: ["logintext", "textlogin", "logintexto", "textologin"],
    handler: commandDefineTextLogin,
    permissions: ["ADM"]
  }
];
async function handlerCommand(client, message) {
  const text = message.caption || message.body;
  if (!text?.startsWith("/"))
    return false;
  const [name, ...args] = text.split(" ");
  const nameCmd = name.slice(1).toLowerCase();
  const command = {
    name,
    args
  };
  try {
    const cmdFound = commands.find((cmd) => cmd.alias.includes(nameCmd));
    if (!cmdFound)
      return false;
    if (cmdFound.permissions) {
      const userId = message.author || message.from;
      const owners = process.env.OWNER_PHONE?.split(",")?.map((owner) => `${owner.trim()}@c.us`) || [];
      const isOwner = owners.includes(userId);
      const isAdmin = await prisma_default.admins.findFirst({
        where: {
          wid: userId,
          bot: {
            wid: client.wid
          }
        }
      });
      const isOwnerBot = await prisma_default.bot.findUnique({
        where: {
          wid: client.wid,
          owner: userId
        }
      });
      if (cmdFound.permissions.includes("ADM") && !isAdmin && !isOwner && !isOwnerBot) {
        client.sendText(message.from, "Acesso negado (1)!");
        return true;
      }
      if (cmdFound.permissions.includes("OWNER") && !isOwner) {
        client.sendText(message.from, "Acesso negado (2)!");
        return true;
      }
    }
    await cmdFound.handler(client, message, command);
    return true;
  } catch (error) {
    await client.sendText(
      message.from,
      "Ocorreu um erro ao processar sua mensagem. Tente novamente ou entre em contato com o suporte."
    );
    await notifyError(client, message, "Command", error);
    return true;
  }
}

// src/events/message.ts
var prisma9 = new import_client9.PrismaClient();
async function onMessage(client, message) {
  if (message.fromMe)
    return;
  let sensitive = telegramSensitive(client.wid, message.from, message.body);
  try {
    for (const field of ["from", "author"]) {
      const address = message[field];
      if (!address?.endsWith("@lid"))
        continue;
      const entry = await client.getPnLidEntry(address);
      if (entry.phoneNumber?._serialized) {
        message[field] = entry.phoneNumber._serialized;
      }
    }
    sensitive ||= telegramSensitive(client.wid, message.from, message.body);
    const isPrivate = message.from.endsWith("@c.us") || message.from.endsWith("@lid");
    console.log(`Mensagem recebida: conversa ${isPrivate ? "privada" : "grupo/outro"}`);
    if (isPrivate) {
      await upsertUser(client, message);
    }
    const isBlocked = await verifyBotBlocked(client, message);
    if (isBlocked)
      return;
    if (isPrivate) {
      const isMaintenance = await verifyMaintenance(client, message);
      if (isMaintenance)
        return;
    }
    if (await handleTelegram(client, message))
      return;
    const isCommand = await handlerCommand(client, message);
    if (isCommand)
      return;
    if (isPrivate) {
      const isConfigured = await initialSettings(client, message, false);
      if (!isConfigured)
        return;
      await menu(client, message);
    }
  } catch (error) {
    console.error("Falha ao processar mensagem:", sensitive ? "Falha ao processar v\xEDnculo Telegram." : error);
    await client.sendText(
      message.from,
      "Ocorreu um erro ao processar sua mensagem. Tente novamente ou entre em contato com o suporte."
    );
    await notifyError(client, sensitive ? { ...message, body: "[c\xF3digo de v\xEDnculo omitido]" } : message, "Message", sensitive ? new Error("Falha ao processar v\xEDnculo Telegram.") : error);
  }
}
async function upsertUser(client, message) {
  const widSender = message.author || message.from;
  const bot = await prisma9.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  const user = await prisma9.user.findFirst({
    where: {
      wid: widSender,
      bot: {
        wid: client.wid
      }
    }
  });
  if (!user && bot.bonus > 0) {
    await client.sendText(widSender, `\u{1F4B0} Bon\xFAs de novo usu\xE1rio de R$${bot.bonus}`);
  }
  if (user)
    return;
  await prisma9.user.create({
    data: {
      wid: widSender,
      balance: bot?.bonus,
      bot: {
        connect: {
          wid: client.wid
        }
      }
    }
  });
}
async function verifyBotBlocked(client, message) {
  const bot = await prisma9.bot.findUnique({
    where: {
      wid: client.wid
    },
    select: {
      block: true
    }
  });
  const userId = message.author || message.from;
  const owners = process.env.OWNER_PHONE?.split(",")?.map((owner) => `${owner.trim()}@c.us`) || [];
  const isOwner = owners.includes(userId);
  if (isOwner)
    return false;
  if (bot?.block) {
    client.sendText(message.from, "Este bot est\xE1 bloqueado! Contate o suporte.");
    return true;
  }
}
async function verifyMaintenance(client, message) {
  const bot = await prisma9.bot.findUnique({
    where: {
      wid: client.wid
    },
    select: {
      maintenance: true,
      owner: true,
      admins: {
        select: {
          wid: true
        }
      }
    }
  });
  const userId = message.author || message.from;
  const owners = process.env.OWNER_PHONE?.split(",")?.map((owner) => `${owner.trim()}@c.us`) || [];
  const isOwner = owners.includes(userId);
  if (isOwner)
    return false;
  bot?.admins.push({ wid: bot?.owner });
  const isAdmin = bot?.admins?.some((admin) => admin.wid === userId);
  if (isAdmin)
    return false;
  if (bot?.maintenance) {
    client.sendText(message.from, "Bot em manuten\xE7\xE3o! Tente novamente mais tarde.");
    return true;
  }
}

// src/helpers/util.ts
function generatePhone() {
  const ddds = [
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    21,
    22,
    24,
    27,
    28,
    31,
    32,
    33,
    34,
    35,
    37,
    38,
    41,
    42,
    43,
    44,
    45,
    46,
    47,
    48,
    49,
    51,
    53,
    54,
    55,
    61,
    62,
    63,
    64,
    65,
    66,
    67,
    68,
    69,
    71,
    73,
    74,
    75,
    77,
    79,
    81,
    82,
    83,
    84,
    85,
    86,
    87,
    88,
    89,
    91,
    92,
    93,
    94,
    95,
    96,
    97,
    98,
    99
  ];
  const ddd = ddds[random(0, ddds.length - 1)];
  const phone = random(1e7, 99999999).toString();
  return `55${ddd}9${phone}`;
}
function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/events/fakeNotify.ts
async function fakeNotify(client) {
  setInterval(async () => {
    await sleep(random(1e3 * 60, 1e3 * 60 * 5));
    const bot = await prisma_default.bot.findUnique({
      where: {
        wid: client.wid
      },
      select: {
        fakeNotify: true,
        loginsSettings: true,
        logins: true
      }
    });
    if (!bot) {
      throw new Error("Bot not found");
    }
    if (!bot.fakeNotify)
      return;
    const logins = bot.loginsSettings.filter(
      (login2) => bot.logins.filter(({ name }) => name === login2.name)
    );
    if (logins.length === 0)
      return;
    const login = logins[random(0, logins.length - 1)];
    notifySales(client, login, generatePhone());
  }, 1e3 * 60 * 5);
}

// src/helpers/sessionPhone.ts
var import_promises2 = require("fs/promises");
var import_node_path2 = __toESM(require("path"));
async function saveBotPhone(phone) {
  if (!/^[1-9]\d{9,14}$/.test(phone))
    throw new Error("N\xFAmero de sess\xE3o inv\xE1lido.");
  const filename = import_node_path2.default.resolve(".env");
  let contents = "";
  try {
    contents = await (0, import_promises2.readFile)(filename, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT")
      throw error;
  }
  const setting = /^\s*(?:export[ \t]+)?BOT_PHONE[ \t]*=[^\r\n]*/gm;
  if (setting.test(contents)) {
    contents = contents.replace(setting, `BOT_PHONE=${phone}`);
  } else {
    contents += `${contents && !contents.endsWith("\n") ? "\n" : ""}BOT_PHONE=${phone}
`;
  }
  await (0, import_promises2.writeFile)(filename, contents, "utf8");
}

// src/index.ts
var prisma10 = new import_client10.PrismaClient();
var clients = {};
var releaseLock;
var shuttingDown = false;
async function shutdown(exitCode = 0) {
  if (shuttingDown)
    return;
  shuttingDown = true;
  await Promise.allSettled(Object.values(clients).map((client) => client.close()));
  await prisma10.$disconnect();
  releaseLock?.();
  process.exit(exitCode);
}
process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
process.once("exit", () => releaseLock?.());
async function start() {
  releaseLock = acquireRuntimeLock();
  await main();
}
start().catch(async (error) => {
  console.error("Falha ao iniciar o bot:", error instanceof Error ? error.message : error);
  await shutdown(1);
});
async function main() {
  const owners = process.env.OWNER_PHONE?.split(",")?.map((owner) => `${owner.trim()}@c.us`) || [];
  const previousBot = await prisma10.bot.findFirst({
    where: { name: "Principal" },
    orderBy: { id: "asc" }
  });
  const mainClient = await createBot(previousBot);
  clients.__starting = mainClient;
  const connectedWid = (await mainClient.getWid())?.replace(/:\d+(?=@)/, "").replace(/@s\.whatsapp\.net$/, "@c.us");
  if (!connectedWid || !/^[1-9]\d{9,14}@c\.us$/.test(connectedWid)) {
    await mainClient.close();
    throw new Error("N\xE3o foi poss\xEDvel identificar o n\xFAmero da sess\xE3o conectada.");
  }
  let mainBot;
  try {
    mainBot = await prisma10.$transaction(async (tx) => {
      const existing = await tx.bot.findUnique({ where: { wid: connectedWid } });
      if (existing && previousBot && existing.id !== previousBot.id) {
        throw new Error("O n\xFAmero conectado j\xE1 pertence a outro cadastro. Os cadastros foram preservados.");
      }
      const owner = owners[0] || previousBot?.owner || connectedWid;
      const bot = previousBot ? await tx.bot.update({ where: { id: previousBot.id }, data: { wid: connectedWid, owner } }) : await tx.bot.upsert({ where: { wid: connectedWid }, create: { wid: connectedWid, name: "Principal", owner }, update: { name: "Principal", owner } });
      if (previousBot && previousBot.wid !== connectedWid) {
        await tx.botMaster.updateMany({ where: { botId: bot.id, wid: previousBot.wid }, data: { wid: connectedWid } });
      }
      await tx.botMaster.upsert({ where: { wid: connectedWid }, create: { wid: connectedWid, botId: bot.id }, update: { botId: bot.id } });
      return bot;
    });
  } catch (error) {
    await mainClient.close();
    throw error;
  }
  mainClient.db = mainBot;
  const phone = connectedWid.split("@")[0];
  process.env.BOT_PHONE = phone;
  try {
    await saveBotPhone(phone);
  } catch (error) {
    console.warn("Bot conectado, mas n\xE3o foi poss\xEDvel salvar BOT_PHONE no .env:", error);
  }
  await handler(mainClient);
  delete clients.__starting;
  const bots = process.env.START_ALL_BOTS === "true" ? await prisma10.bot.findMany({ where: { id: { not: mainBot.id } }, orderBy: { id: "asc" } }) : [];
  const orderedBots = bots;
  const sessions = /* @__PURE__ */ new Set([mainBot.name.toLowerCase()]);
  const uniqueBots = orderedBots.filter((bot) => {
    const session = bot.name.toLowerCase();
    if (sessions.has(session)) {
      console.warn(`Bot ID ${bot.id} ignorado: a sess\xE3o "${bot.name}" j\xE1 est\xE1 em uso por outro cadastro.`);
      return false;
    }
    sessions.add(session);
    return true;
  });
  for (const bot of uniqueBots) {
    try {
      const client = await createBot(bot);
      await handler(client);
    } catch (error) {
      console.error(`Falha ao conectar o bot "${bot.name}" (ID ${bot.id}):`, error);
    }
  }
}
async function handler(client) {
  const expectedBot = client.db;
  const connectedWid = await client.getWid();
  client.wid = connectedWid?.replace(/:\d+(?=@)/, "").replace(/@s\.whatsapp\.net$/, "@c.us");
  if (!client.wid) {
    throw new Error("Wid not found");
  }
  if (expectedBot && client.wid !== expectedBot.wid) {
    await client.close();
    throw new Error(`A sess\xE3o "${expectedBot.name}" conectou a conta ${client.wid}, mas o cadastro espera ${expectedBot.wid}. Use o WhatsApp do n\xFAmero cadastrado; confira BOT_PHONE no .env para o Principal.`);
  }
  client.db = await prisma10.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  if (!client.db) {
    throw new Error(`O n\xFAmero conectado (${client.wid}) n\xE3o est\xE1 cadastrado como bot.`);
  }
  clients[client.wid] = client;
  client.onMessage((message) => onMessage(client, message));
  client.onPollResponse((poll) => onPollResponse(client, poll));
  console.log(`Bot "${client.db.name}" pronto para receber mensagens.`);
  fakeNotify(client);
  return client;
}

// src/commands/newBot.ts
var prisma11 = new import_client11.PrismaClient();
async function commandNewBot(client, message, command) {
  const [phoneBot, phoneOwner, ...rest] = command.args;
  const nameBot = rest.join(" ");
  if (!phoneBot || !phoneOwner || !nameBot) {
    client.sendText(
      message.from,
      "Forma de uso: /newbot [NUMERO DO BOT] [NUMERO DO DONO] [NOME DO BOT]\n\nExemplo: /newbot 5511999999999 5511999999999 bot-chocolate"
    );
    return;
  }
  const bot = await prisma11.bot.upsert({
    where: {
      wid: `${phoneBot}@c.us`
    },
    create: {
      wid: `${phoneBot}@c.us`,
      name: nameBot,
      owner: `${phoneOwner}@c.us`
    },
    update: {
      owner: `${phoneOwner}@c.us`
    }
  });
  await client.sendText(message.from, `Bot *${bot.name}* criado com sucesso, iniciando...`);
  notifyAdmin(client, `O bot *${bot.name}* foi criado e iniciado pelo admin *${message.author || message.from}*.`);
  let qrcodeSended = false;
  const clientBotCreated = await createBot(bot, {
    catchQR: async (base64Qrimg, asciiQR, attempt, urlCode) => {
      if (qrcodeSended)
        return;
      const png = import_qr_image4.default.imageSync(urlCode, { type: "png" });
      let base64 = Buffer.from(png).toString("base64");
      base64 = `data:image/png;base64,${base64}`;
      await client.sendImageFromBase64(
        message.from,
        base64,
        "qr_code",
        "Leia o QR Code para iniciar a sess\xE3o!"
      );
      qrcodeSended = true;
    },
    statusFind: (status) => {
      if (status === "notLogged" || status === "disconnectedMobile")
        return;
      if (status === "qrReadError" || status === "qrReadFail") {
        client.sendText(message.from, "Erro ao ler o QR Code, tente cria-lo novamente!", { quotedMsg: message.id });
        return;
      }
      if (status === "qrReadSuccess") {
        client.sendText(message.from, "QR Code lido com sucesso, iniciando a sess\xE3o!", { quotedMsg: message.id });
        return;
      }
    }
  });
  handler(clientBotCreated);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandNewBot
});
