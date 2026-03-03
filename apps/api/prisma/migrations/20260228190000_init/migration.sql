CREATE TABLE "recipients" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "chat_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "recipients_chat_id_key" ON "recipients"("chat_id");

CREATE TABLE "whatsapp_creds" (
  "session_id" TEXT NOT NULL PRIMARY KEY,
  "creds" TEXT NOT NULL
);

CREATE TABLE "whatsapp_keys" (
  "session_id" TEXT NOT NULL,
  "key_id" TEXT NOT NULL,
  "key_data" TEXT NOT NULL,
  PRIMARY KEY ("session_id", "key_id")
);
