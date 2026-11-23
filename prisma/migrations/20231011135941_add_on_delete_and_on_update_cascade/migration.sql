-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LoginsSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "botId" INTEGER NOT NULL,
    CONSTRAINT "LoginsSettings_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LoginsSettings" ("botId", "id", "name", "price") SELECT "botId", "id", "name", "price" FROM "LoginsSettings";
DROP TABLE "LoginsSettings";
ALTER TABLE "new_LoginsSettings" RENAME TO "LoginsSettings";
CREATE UNIQUE INDEX "LoginsSettings_name_key" ON "LoginsSettings"("name");
CREATE TABLE "new_BotMaster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wid" TEXT NOT NULL,
    "mercadoPagoToken" TEXT NOT NULL DEFAULT '',
    "priceWeek" INTEGER NOT NULL DEFAULT 10,
    "botId" INTEGER NOT NULL,
    CONSTRAINT "BotMaster_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BotMaster" ("botId", "id", "mercadoPagoToken", "priceWeek", "wid") SELECT "botId", "id", "mercadoPagoToken", "priceWeek", "wid" FROM "BotMaster";
DROP TABLE "BotMaster";
ALTER TABLE "new_BotMaster" RENAME TO "BotMaster";
CREATE UNIQUE INDEX "BotMaster_wid_key" ON "BotMaster"("wid");
CREATE TABLE "new_Admins" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wid" TEXT NOT NULL,
    "botId" INTEGER NOT NULL,
    CONSTRAINT "Admins_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Admins" ("botId", "id", "wid") SELECT "botId", "id", "wid" FROM "Admins";
DROP TABLE "Admins";
ALTER TABLE "new_Admins" RENAME TO "Admins";
CREATE TABLE "new_Affiliateds" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wid" TEXT NOT NULL,
    "botId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Affiliateds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Affiliateds_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Affiliateds" ("botId", "id", "userId", "wid") SELECT "botId", "id", "userId", "wid" FROM "Affiliateds";
DROP TABLE "Affiliateds";
ALTER TABLE "new_Affiliateds" RENAME TO "Affiliateds";
CREATE TABLE "new_Logins" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "additional" TEXT NOT NULL DEFAULT '',
    "botId" INTEGER NOT NULL,
    "settingId" INTEGER NOT NULL,
    CONSTRAINT "Logins_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "LoginsSettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Logins_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Logins" ("additional", "botId", "id", "name", "password", "settingId", "user") SELECT "additional", "botId", "id", "name", "password", "settingId", "user" FROM "Logins";
DROP TABLE "Logins";
ALTER TABLE "new_Logins" RENAME TO "Logins";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wid" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "affiliated" TEXT NOT NULL DEFAULT '',
    "botId" INTEGER NOT NULL,
    CONSTRAINT "User_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("affiliated", "balance", "botId", "id", "wid") SELECT "affiliated", "balance", "botId", "id", "wid" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE TABLE "new_LoginsHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loginName" TEXT NOT NULL,
    "loginPrice" INTEGER NOT NULL,
    "loginUser" TEXT NOT NULL,
    "loginPassword" TEXT NOT NULL,
    "loginAdditional" TEXT NOT NULL DEFAULT '',
    "createAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "botId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "LoginsHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoginsHistory_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LoginsHistory" ("botId", "createAt", "id", "loginAdditional", "loginName", "loginPassword", "loginPrice", "loginUser", "userId") SELECT "botId", "createAt", "id", "loginAdditional", "loginName", "loginPassword", "loginPrice", "loginUser", "userId" FROM "LoginsHistory";
DROP TABLE "LoginsHistory";
ALTER TABLE "new_LoginsHistory" RENAME TO "LoginsHistory";
CREATE TABLE "new_Gifts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "redeemed" BOOLEAN NOT NULL DEFAULT false,
    "createAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" DATETIME,
    "botId" INTEGER NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "Gifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Gifts_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Gifts" ("amount", "botId", "code", "createAt", "id", "redeemed", "redeemedAt", "userId") SELECT "amount", "botId", "code", "createAt", "id", "redeemed", "redeemedAt", "userId" FROM "Gifts";
DROP TABLE "Gifts";
ALTER TABLE "new_Gifts" RENAME TO "Gifts";
CREATE UNIQUE INDEX "Gifts_code_key" ON "Gifts"("code");
CREATE TABLE "new_PixHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" INTEGER NOT NULL,
    "createAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "botId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "PixHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PixHistory_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PixHistory" ("amount", "botId", "createAt", "id", "userId") SELECT "amount", "botId", "createAt", "id", "userId" FROM "PixHistory";
DROP TABLE "PixHistory";
ALTER TABLE "new_PixHistory" RENAME TO "PixHistory";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
