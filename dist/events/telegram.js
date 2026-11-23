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

// src/events/telegram.ts
var telegram_exports = {};
__export(telegram_exports, {
  TELEGRAM_HELP_OPTION: () => TELEGRAM_HELP_OPTION,
  TELEGRAM_STORE_OPTION: () => TELEGRAM_STORE_OPTION,
  handleTelegram: () => handleTelegram,
  inviteTelegram: () => inviteTelegram,
  telegramSensitive: () => telegramSensitive
});
module.exports = __toCommonJS(telegram_exports);

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

// src/services/telegramWallet.ts
async function getWalletOperation(phone, id) {
  if (!/^[a-f0-9]{64}$/.test(id))
    throw new TelegramApiError(400);
  return telegramApi(`/api/whatsapp/v1/clientes/${phone}/operacoes/${id}`);
}

// src/buttons/telegramWallet.ts
var money = (v) => typeof v === "number" && Number.isFinite(v) ? `R$ ${v.toFixed(2)}` : "indispon\xEDvel";
var safe = (v) => String(v ?? "").slice(0, 1500);
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
var busy = /* @__PURE__ */ new Set();
var skipped = /* @__PURE__ */ new Set();
var TELEGRAM_STORE_OPTION = "\u27A1\uFE0F N\xE3o tenho Telegram \xB7 ir para a loja";
var TELEGRAM_HELP_OPTION = "\u{1F198} Preciso de ajuda";
async function inviteTelegram(client, to) {
  const key = `${client.wid}:${to}`;
  for (const [entry, deadline] of pending)
    if (deadline < Date.now())
      pending.delete(entry);
  pending.set(key, Date.now() + 5 * 60 * 1e3);
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
  const commands = ["/telegram", "/vincular", "/saldotelegram", "/historicotelegram", "/catalogotelegram", "/cancelar", "/loja", "/ajudavinculo", "/statuspix", "/operacaotelegram"];
  const key = `${client.wid}:${message.from}`;
  const expires = pending.get(key);
  if (expires && expires < Date.now())
    pending.delete(key);
  if (!commands.includes(command) && (!pending.has(key) || text.startsWith("/"))) {
    if (text.startsWith("/") && command !== "/menu" || skipped.has(key) || message.fromMe || message.isGroupMsg || !telegramEnabled(client.wid) || !/@(?:c\.us|s\.whatsapp\.net)$/.test(message.from))
      return false;
    if (busy.has(key))
      return true;
    busy.add(key);
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
      busy.delete(key);
    }
    if (!needsLink)
      return false;
    return handleTelegram(client, { ...message, body: "/vincular" });
  }
  if (message.fromMe)
    return true;
  if (!telegramEnabled(client.wid)) {
    if (commands.includes(command) && command !== "/cancelar")
      await client.sendText(message.from, "Integra\xE7\xE3o Telegram indispon\xEDvel neste bot.");
    return commands.includes(command);
  }
  if (message.isGroupMsg || !/@(?:c\.us|s\.whatsapp\.net|lid)$/.test(message.from)) {
    await client.sendText(message.from, "Use estes comandos em conversa privada com o bot oficial.");
    return true;
  }
  if (busy.has(key)) {
    await client.sendText(message.from, "Aguarde a consulta anterior terminar.");
    return true;
  }
  busy.add(key);
  try {
    const phone = telegramPhone(message.from);
    if (command === "/statuspix" || command === "/operacaotelegram")
      await walletStatus(client, message.from, command, args[0] || "");
    else if (command === "/cancelar") {
      pending.delete(key);
      await client.sendText(message.from, "Envio do c\xF3digo cancelado.");
    } else if (command === "/loja") {
      pending.delete(key);
      skipped.add(key);
      return false;
    } else if (command === "/ajudavinculo") {
      await client.sendText(message.from, "Abra o bot da loja no Telegram ou o site, entre em Meu Perfil e procure Vincular WhatsApp. Copie o c\xF3digo e envie aqui. Se n\xE3o encontrar, digite /loja e selecione Suporte no menu. Para seguir sem vincular, digite /loja.");
    } else if (command === "/telegram") {
      skipped.delete(key);
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
        skipped.delete(key);
        await inviteTelegram(client, message.from);
      } else {
        pending.delete(key);
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
    busy.delete(key);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TELEGRAM_HELP_OPTION,
  TELEGRAM_STORE_OPTION,
  handleTelegram,
  inviteTelegram,
  telegramSensitive
});
