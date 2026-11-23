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

// src/commands/addStock.ts
var addStock_exports = {};
__export(addStock_exports, {
  commandAddStock: () => commandAddStock
});
module.exports = __toCommonJS(addStock_exports);
var import_client2 = require("@prisma/client");

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

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

// src/commands/addStock.ts
var prisma2 = new import_client2.PrismaClient();
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
    const stocks = await prisma2.logins.create({
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandAddStock
});
