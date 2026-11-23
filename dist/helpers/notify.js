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

// src/helpers/notify.ts
var notify_exports = {};
__export(notify_exports, {
  notifyAdmin: () => notifyAdmin,
  notifyError: () => notifyError,
  notifyOwner: () => notifyOwner
});
module.exports = __toCommonJS(notify_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  notifyAdmin,
  notifyError,
  notifyOwner
});
