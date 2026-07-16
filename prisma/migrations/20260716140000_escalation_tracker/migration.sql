-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem_context" TEXT NOT NULL,
    "latest_context" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "slack_channel_id" TEXT NOT NULL,
    "slack_message_ts" TEXT NOT NULL,
    "reporter_slack_id" TEXT,
    "reporter_name" TEXT,
    "reporter_email" TEXT,
    "latest_update_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_updates" (
    "id" TEXT NOT NULL,
    "escalation_id" TEXT NOT NULL,
    "slack_user_id" TEXT,
    "author_name" TEXT,
    "author_email" TEXT,
    "body" TEXT NOT NULL,
    "slack_message_ts" TEXT NOT NULL,
    "inferred_status" TEXT,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escalations_slack_message_ts_key" ON "escalations"("slack_message_ts");

-- CreateIndex
CREATE INDEX "escalations_status_idx" ON "escalations"("status");

-- CreateIndex
CREATE INDEX "escalations_priority_idx" ON "escalations"("priority");

-- CreateIndex
CREATE INDEX "escalations_latest_update_at_idx" ON "escalations"("latest_update_at");

-- CreateIndex
CREATE INDEX "escalations_created_at_idx" ON "escalations"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "escalation_updates_slack_message_ts_key" ON "escalation_updates"("slack_message_ts");

-- CreateIndex
CREATE INDEX "escalation_updates_escalation_id_created_at_idx" ON "escalation_updates"("escalation_id", "created_at");

-- AddForeignKey
ALTER TABLE "escalation_updates" ADD CONSTRAINT "escalation_updates_escalation_id_fkey" FOREIGN KEY ("escalation_id") REFERENCES "escalations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
