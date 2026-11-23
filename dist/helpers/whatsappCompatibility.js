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

// src/helpers/whatsappCompatibility.ts
var whatsappCompatibility_exports = {};
__export(whatsappCompatibility_exports, {
  installWhatsAppCompatibility: () => installWhatsAppCompatibility,
  patchLidUserPrefs: () => patchLidUserPrefs
});
module.exports = __toCommonJS(whatsappCompatibility_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  installWhatsAppCompatibility,
  patchLidUserPrefs
});
