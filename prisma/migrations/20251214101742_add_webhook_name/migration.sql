/*
  Warnings:

  - Added the required column `name` to the `webhooks` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_webhooks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "events" TEXT NOT NULL,
    "jobIds" TEXT,
    "headers" TEXT,
    "payload" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_webhooks" ("createdAt", "events", "headers", "id", "isActive", "jobIds", "method", "payload", "url", "name") SELECT "createdAt", "events", "headers", "id", "isActive", "jobIds", "method", "payload", "url", "url" as "name" FROM "webhooks";
DROP TABLE "webhooks";
ALTER TABLE "new_webhooks" RENAME TO "webhooks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
