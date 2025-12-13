-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "datasourceId" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "destinationPath" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jobs_datasourceId_fkey" FOREIGN KEY ("datasourceId") REFERENCES "datasources" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_jobs" ("createdAt", "cronExpression", "datasourceId", "destinationPath", "id", "isActive", "status", "title") SELECT "createdAt", "cronExpression", "datasourceId", "destinationPath", "id", "isActive", "status", "title" FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "new_jobs" RENAME TO "jobs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
