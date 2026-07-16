-- AlterTable
ALTER TABLE "escalation_updates" ADD COLUMN "attachments" TEXT;
ALTER TABLE "escalations" ADD COLUMN "ai_issue_description" TEXT;
