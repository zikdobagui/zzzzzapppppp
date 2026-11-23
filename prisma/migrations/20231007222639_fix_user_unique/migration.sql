-- DropIndex
DROP INDEX "User_wid_key";

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bot" (
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
    "textAffiliateds" TEXT NOT NULL DEFAULT 'Compartilhe seu link e ganhe bonus a cada pix inserido',
    "expireAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "block" BOOLEAN NOT NULL DEFAULT false,
    "doubleBalance" BOOLEAN NOT NULL DEFAULT false,
    "notifyFalse" BOOLEAN NOT NULL DEFAULT false,
    "bonus" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Bot" ("block", "expireAt", "id", "mercadoPagoToken", "name", "notifySalesWid", "owner", "pixManualAdditional", "pixManualKey", "pixMax", "pixMin", "pixType", "textAffiliateds", "textLogin", "textMenu", "textPix", "textPixManual", "textSupport", "wid") SELECT "block", "expireAt", "id", "mercadoPagoToken", "name", "notifySalesWid", "owner", "pixManualAdditional", "pixManualKey", "pixMax", "pixMin", "pixType", "textAffiliateds", "textLogin", "textMenu", "textPix", "textPixManual", "textSupport", "wid" FROM "Bot";
DROP TABLE "Bot";
ALTER TABLE "new_Bot" RENAME TO "Bot";
CREATE UNIQUE INDEX "Bot_wid_key" ON "Bot"("wid");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
