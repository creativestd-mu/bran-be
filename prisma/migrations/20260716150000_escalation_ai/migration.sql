-- AlterTable
ALTER TABLE "escalations" ADD COLUMN "ai_summary" TEXT;
ALTER TABLE "escalations" ADD COLUMN "suggested_next_steps" TEXT;
ALTER TABLE "escalations" ADD COLUMN "ai_blockers" TEXT;
ALTER TABLE "escalations" ADD COLUMN "ai_analyzed_at" TIMESTAMP(3);
