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

// src/connection.ts
var connection_exports = {};
__export(connection_exports, {
  createBot: () => createBot
});
module.exports = __toCommonJS(connection_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createBot
});
