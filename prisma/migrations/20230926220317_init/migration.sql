-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wid" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "affiliated" TEXT NOT NULL DEFAULT '',
    "botId" INTEGER NOT NULL,
    CONSTRAINT "User_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "mercadoPagoToken" TEXT NOT NULL DEFAULT '',
    "pixManualKey" TEXT NOT NULL DEFAULT '',
    "pixManualAdditional" TEXT NOT NULL DEFAULT '',
    "pixType" TEXT NOT NULL DEFAULT 'auto',
    "pixMin" INTEGER NOT NULL DEFAULT 1,
    "pixMax" INTEGER NOT NULL DEFAULT 100,
    "notifySalesWid" TEXT NOT NULL DEFAULT '',
    "textMenu" TEXT NOT NULL DEFAULT 'Menu',
    "textSupport" TEXT NOT NULL DEFAULT 'Suporte',
    "textPix" TEXT NOT NULL DEFAULT '',
    "textLogin" TEXT NOT NULL DEFAULT 'Selecione um Login',
    "textPixManual" TEXT NOT NULL DEFAULT 'Envie o comprovante para o suporte',
    "textAffiliateds" TEXT NOT NULL DEFAULT 'Compartilhe seu link e ganhe bonus a cada pix inserido'
);

-- CreateTable
CREATE TABLE "Logins" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "additional" TEXT NOT NULL DEFAULT '',
    "botId" INTEGER NOT NULL,
    "settingId" INTEGER NOT NULL,
    CONSTRAINT "Logins_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "LoginsSettings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Logins_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginsSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "botId" INTEGER NOT NULL,
    CONSTRAINT "LoginsSettings_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Affiliateds" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wid" TEXT NOT NULL,
    "botId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Affiliateds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Affiliateds_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginsHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loginName" TEXT NOT NULL,
    "loginPrice" INTEGER NOT NULL,
    "loginUser" TEXT NOT NULL,
    "loginPassword" TEXT NOT NULL,
    "loginAdditional" TEXT NOT NULL DEFAULT '',
    "createAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "botId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "LoginsHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LoginsHistory_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gifts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "redeemed" BOOLEAN NOT NULL DEFAULT false,
    "createAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" DATETIME,
    "botId" INTEGER NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "Gifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Gifts_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Admins" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wid" TEXT NOT NULL,
    "botId" INTEGER NOT NULL,
    CONSTRAINT "Admins_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PixHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" INTEGER NOT NULL,
    "createAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "botId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "PixHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PixHistory_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wid_key" ON "User"("wid");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_wid_key" ON "Bot"("wid");

-- CreateIndex
CREATE UNIQUE INDEX "LoginsSettings_name_key" ON "LoginsSettings"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliateds_wid_key" ON "Affiliateds"("wid");

-- CreateIndex
CREATE UNIQUE INDEX "Gifts_code_key" ON "Gifts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Admins_wid_key" ON "Admins"("wid");
