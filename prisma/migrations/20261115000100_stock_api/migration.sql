-- CreateTable
CREATE TABLE "StockApiOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestKey" TEXT NOT NULL,
    "botId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "serviceName" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "cost" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "accessJson" TEXT,
    "historyId" INTEGER,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockApiOrder_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockApiOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LoginsSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "image" BLOB,
    "text" TEXT NOT NULL DEFAULT '',
    "botId" INTEGER NOT NULL,
    CONSTRAINT "LoginsSettings_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LoginsSettings" ("botId", "id", "image", "name", "price", "text") SELECT "botId", "id", "image", "name", "price", "text" FROM "LoginsSettings";
DROP TABLE "LoginsSettings";
ALTER TABLE "new_LoginsSettings" RENAME TO "LoginsSettings";
CREATE UNIQUE INDEX "LoginsSettings_name_key" ON "LoginsSettings"("name");
CREATE TABLE "new_LoginsHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loginName" TEXT NOT NULL,
    "loginPrice" REAL NOT NULL,
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
CREATE TABLE "new_PixHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "amount" REAL NOT NULL,
    "createAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "botId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "PixHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PixHistory_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PixHistory" ("amount", "botId", "createAt", "id", "userId") SELECT "amount", "botId", "createAt", "id", "userId" FROM "PixHistory";
DROP TABLE "PixHistory";
ALTER TABLE "new_PixHistory" RENAME TO "PixHistory";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wid" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "affiliated" TEXT NOT NULL DEFAULT '',
    "botId" INTEGER NOT NULL,
    CONSTRAINT "User_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("affiliated", "balance", "botId", "id", "wid") SELECT "affiliated", "balance", "botId", "id", "wid" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "StockApiOrder_requestKey_key" ON "StockApiOrder"("requestKey");

-- CreateIndex
CREATE INDEX "StockApiOrder_botId_status_idx" ON "StockApiOrder"("botId", "status");

-- CreateIndex
CREATE INDEX "StockApiOrder_userId_status_idx" ON "StockApiOrder"("userId", "status");
