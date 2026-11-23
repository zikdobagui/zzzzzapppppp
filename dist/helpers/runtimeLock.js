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

// src/helpers/runtimeLock.ts
var runtimeLock_exports = {};
__export(runtimeLock_exports, {
  acquireRuntimeLock: () => acquireRuntimeLock
});
module.exports = __toCommonJS(runtimeLock_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  acquireRuntimeLock
});
