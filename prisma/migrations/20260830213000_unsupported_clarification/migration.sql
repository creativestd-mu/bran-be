-- AlterTable
ALTER TABLE "UnsupportedSlackQuery" ADD COLUMN IF NOT EXISTS "clarificationText" TEXT;
ALTER TABLE "UnsupportedSlackQuery" ADD COLUMN IF NOT EXISTS "resolvedIntent" TEXT;
