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

// src/helpers/sessionLogin.ts
var sessionLogin_exports = {};
__export(sessionLogin_exports, {
  loginSavedSessionFirst: () => loginSavedSessionFirst
});
module.exports = __toCommonJS(sessionLogin_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  loginSavedSessionFirst
});
