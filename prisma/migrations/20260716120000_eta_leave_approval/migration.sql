-- AlterTable
ALTER TABLE "eta_entries" ADD COLUMN IF NOT EXISTS "leave_approval_state" TEXT;
ALTER TABLE "eta_entries" ADD COLUMN IF NOT EXISTS "leave_approved_at" TIMESTAMP(3);
ALTER TABLE "eta_entries" ADD COLUMN IF NOT EXISTS "leave_approved_by_slack_user_id" TEXT;
ALTER TABLE "eta_entries" ADD COLUMN IF NOT EXISTS "leave_approval_note" TEXT;

-- Existing leave submissions need an approval state for manager workflow.
UPDATE "eta_entries"
SET "leave_approval_state" = 'pending'
WHERE "record_type" = 'leave' AND "leave_approval_state" IS NULL;
