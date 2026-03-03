-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_recipients" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chat_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_recipients" ("chat_id", "created_at", "id", "name", "type", "updated_at") SELECT "chat_id", "created_at", "id", "name", "type", "updated_at" FROM "recipients";
DROP TABLE "recipients";
ALTER TABLE "new_recipients" RENAME TO "recipients";
CREATE UNIQUE INDEX "recipients_chat_id_key" ON "recipients"("chat_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
