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

// src/helpers/sessionPhone.ts
var sessionPhone_exports = {};
__export(sessionPhone_exports, {
  saveBotPhone: () => saveBotPhone
});
module.exports = __toCommonJS(sessionPhone_exports);
var import_promises = require("fs/promises");
var import_node_path = __toESM(require("path"));
async function saveBotPhone(phone) {
  if (!/^[1-9]\d{9,14}$/.test(phone))
    throw new Error("N\xFAmero de sess\xE3o inv\xE1lido.");
  const filename = import_node_path.default.resolve(".env");
  let contents = "";
  try {
    contents = await (0, import_promises.readFile)(filename, "utf8");
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
  await (0, import_promises.writeFile)(filename, contents, "utf8");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  saveBotPhone
});
