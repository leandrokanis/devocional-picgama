-- CreateTable
CREATE TABLE "reading_publications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reading_date" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "published_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "reading_publications_reading_date_idx" ON "reading_publications"("reading_date");
