-- CreateTable
CREATE TABLE "slack_voice_work_drafts" (
    "id" TEXT NOT NULL,
    "bran_user_id" TEXT NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "slack_channel_id" TEXT NOT NULL,
    "slack_thread_ts" TEXT NOT NULL,
    "voice_recording_id" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_CONFIRM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slack_voice_work_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slack_voice_work_drafts_voice_recording_id_key" ON "slack_voice_work_drafts"("voice_recording_id");

-- CreateIndex
CREATE INDEX "slack_voice_work_drafts_bran_user_id_idx" ON "slack_voice_work_drafts"("bran_user_id");

-- CreateIndex
CREATE INDEX "slack_voice_work_drafts_slack_user_id_idx" ON "slack_voice_work_drafts"("slack_user_id");

-- CreateIndex
CREATE INDEX "slack_voice_work_drafts_status_idx" ON "slack_voice_work_drafts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "slack_voice_work_drafts_slack_channel_id_slack_thread_ts_key" ON "slack_voice_work_drafts"("slack_channel_id", "slack_thread_ts");

-- AddForeignKey
ALTER TABLE "slack_voice_work_drafts" ADD CONSTRAINT "slack_voice_work_drafts_bran_user_id_fkey" FOREIGN KEY ("bran_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "slack_voice_work_drafts" ADD CONSTRAINT "slack_voice_work_drafts_voice_recording_id_fkey" FOREIGN KEY ("voice_recording_id") REFERENCES "VoiceRecording"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
