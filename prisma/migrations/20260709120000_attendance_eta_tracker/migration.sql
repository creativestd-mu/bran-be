-- CreateTable
CREATE TABLE "slack_members" (
    "slack_user_id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "real_name" TEXT,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3),
    "pod" TEXT NOT NULL DEFAULT 'default',

    CONSTRAINT "slack_members_pkey" PRIMARY KEY ("slack_user_id")
);

-- CreateTable
CREATE TABLE "eta_entries" (
    "id" SERIAL NOT NULL,
    "slack_user_id" TEXT,
    "user_email" TEXT,
    "user_name" TEXT,
    "entry_date" DATE NOT NULL,
    "eta_text" TEXT,
    "eta_minutes" INTEGER,
    "status" TEXT NOT NULL,
    "record_type" TEXT,
    "submitted_at" TIMESTAMP(3),
    "submitted_on_time" BOOLEAN,
    "is_late_arrival" BOOLEAN,
    "raw_message" TEXT,
    "slack_message_ts" TEXT,
    "reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eta_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "eta_entries_slack_user_id_entry_date_key" ON "eta_entries"("slack_user_id", "entry_date");

-- CreateIndex
CREATE INDEX "idx_eta_entries_date_type" ON "eta_entries"("entry_date", "record_type");

-- CreateIndex
CREATE INDEX "eta_entries_entry_date_status_idx" ON "eta_entries"("entry_date", "status");
