-- CreateTable
CREATE TABLE "devotional_audios" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "file_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
