-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN "jobIds" TEXT;

-- CreateTable
CREATE TABLE "job_datasources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "datasourceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_datasources_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "job_datasources_datasourceId_fkey" FOREIGN KEY ("datasourceId") REFERENCES "datasources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate existing job datasource relationships
INSERT INTO "job_datasources" ("id", "jobId", "datasourceId", "createdAt")
SELECT 
    lower(hex(randomblob(16))) as "id",
    "id" as "jobId",
    "datasourceId",
    "createdAt"
FROM "jobs"
WHERE "datasourceId" IS NOT NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "destinationPath" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_jobs" ("createdAt", "cronExpression", "destinationPath", "id", "isActive", "status", "timezone", "title") SELECT "createdAt", "cronExpression", "destinationPath", "id", "isActive", "status", "timezone", "title" FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "new_jobs" RENAME TO "jobs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "job_datasources_jobId_datasourceId_key" ON "job_datasources"("jobId", "datasourceId");
