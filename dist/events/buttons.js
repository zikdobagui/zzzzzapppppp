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

// src/events/buttons.ts
var buttons_exports = {};
__export(buttons_exports, {
  default: () => onPollResponse
});
module.exports = __toCommonJS(buttons_exports);

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
async function handleTelegram(client, message) {
  const text = message.body?.trim() || "";
  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.toLowerCase();
  const commands = ["/telegram", "/vincular", "/saldotelegram", "/historicotelegram", "/catalogotelegram", "/cancelar", "/loja", "/ajudavinculo", "/statuspix", "/operacaotelegram"];
  const key2 = `${client.wid}:${message.from}`;
  const expires = pending.get(key2);
  if (expires && expires < Date.now())
    pending.delete(key2);
  if (!commands.includes(command) && (!pending.has(key2) || text.startsWith("/"))) {
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
    if (commands.includes(command) && command !== "/cancelar")
      await client.sendText(message.from, "Integra\xE7\xE3o Telegram indispon\xEDvel neste bot.");
    return commands.includes(command);
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
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
async function menu(client, message) {
  const botConfig = await prisma.bot.findUnique({
    where: {
      wid: client.wid
    }
  });
  const user = await prisma.user.findFirst({
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

// src/services/prisma.ts
var import_client2 = require("@prisma/client");
var prisma2 = new import_client2.PrismaClient();
var prisma_default = prisma2;

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
async function notifyOwner(client, text) {
  const owners = process.env.OWNER_PHONE?.split(",")?.map((owner) => `${owner.trim()}@c.us`) || [];
  for (const owner of owners) {
    await client.sendText(owner, text);
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  }
}

// src/commands/notifySales.ts
var import_fs = require("fs");
var prisma3 = new import_client3.PrismaClient();
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
var import_util = require("util");
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


${(0, import_util.inspect)(error)}`;
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
