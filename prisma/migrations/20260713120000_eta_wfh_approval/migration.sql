-- AlterTable
ALTER TABLE "eta_entries" ADD COLUMN IF NOT EXISTS "reminder_channel_id" TEXT;
ALTER TABLE "eta_entries" ADD COLUMN IF NOT EXISTS "reminder_slack_ts" TEXT;
ALTER TABLE "eta_entries" ADD COLUMN IF NOT EXISTS "wfh_approval_state" TEXT;
ALTER TABLE "eta_entries" ADD COLUMN IF NOT EXISTS "wfh_approved_at" TIMESTAMP(3);
ALTER TABLE "eta_entries" ADD COLUMN IF NOT EXISTS "wfh_approved_by_slack_user_id" TEXT;
ALTER TABLE "eta_entries" ADD COLUMN IF NOT EXISTS "wfh_approval_note" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "eta_entries_reminder_channel_id_idx" ON "eta_entries"("reminder_channel_id");
CREATE INDEX IF NOT EXISTS "eta_entries_slack_message_ts_idx" ON "eta_entries"("slack_message_ts");
