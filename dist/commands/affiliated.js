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

// src/commands/affiliated.ts
var affiliated_exports = {};
__export(affiliated_exports, {
  commandAffiliated: () => commandAffiliated
});
module.exports = __toCommonJS(affiliated_exports);

// src/services/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var prisma_default = prisma;

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  commandAffiliated
});
