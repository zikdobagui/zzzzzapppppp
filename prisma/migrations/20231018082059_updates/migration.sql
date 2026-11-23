-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LoginsSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "image" BLOB,
    "text" TEXT NOT NULL DEFAULT '',
    "botId" INTEGER NOT NULL,
    CONSTRAINT "LoginsSettings_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LoginsSettings" ("botId", "id", "name", "price") SELECT "botId", "id", "name", "price" FROM "LoginsSettings";
DROP TABLE "LoginsSettings";
ALTER TABLE "new_LoginsSettings" RENAME TO "LoginsSettings";
CREATE UNIQUE INDEX "LoginsSettings_name_key" ON "LoginsSettings"("name");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
