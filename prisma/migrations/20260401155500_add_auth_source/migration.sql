-- AlterTable - Add authSource column to datasources
-- This column is optional (nullable) to maintain backward compatibility
-- For MongoDB datasources, this specifies the authentication database (defaults to 'admin')
ALTER TABLE "datasources" ADD COLUMN "authSource" TEXT;
