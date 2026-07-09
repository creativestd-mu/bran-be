-- CreateTable
CREATE TABLE "attendance_person_stats" (
    "id" TEXT NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_email" TEXT,
    "user_name" TEXT,
    "wfh_count" INTEGER NOT NULL DEFAULT 0,
    "leave_count" INTEGER NOT NULL DEFAULT 0,
    "comp_off_count" INTEGER NOT NULL DEFAULT 0,
    "office_count" INTEGER NOT NULL DEFAULT 0,
    "on_time_count" INTEGER NOT NULL DEFAULT 0,
    "late_submission_count" INTEGER NOT NULL DEFAULT 0,
    "late_arrival_count" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "submitted_count" INTEGER NOT NULL DEFAULT 0,
    "action_status" TEXT NOT NULL DEFAULT 'none',
    "action_note" TEXT,
    "action_taken_by_id" TEXT,
    "action_taken_at" TIMESTAMP(3),
    "last_entry_date" DATE,
    "last_computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_person_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_person_stats_slack_user_id_key" ON "attendance_person_stats"("slack_user_id");

-- CreateIndex
CREATE INDEX "attendance_person_stats_user_email_idx" ON "attendance_person_stats"("user_email");

-- CreateIndex
CREATE INDEX "attendance_person_stats_user_id_idx" ON "attendance_person_stats"("user_id");

-- CreateIndex
CREATE INDEX "attendance_person_stats_action_status_idx" ON "attendance_person_stats"("action_status");

-- CreateIndex
CREATE INDEX "attendance_person_stats_wfh_count_idx" ON "attendance_person_stats"("wfh_count");

-- CreateIndex
CREATE INDEX "attendance_person_stats_late_submission_count_idx" ON "attendance_person_stats"("late_submission_count");

-- CreateIndex
CREATE INDEX "attendance_person_stats_missing_count_idx" ON "attendance_person_stats"("missing_count");

-- AddForeignKey
ALTER TABLE "attendance_person_stats" ADD CONSTRAINT "attendance_person_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "attendance_person_stats" ADD CONSTRAINT "attendance_person_stats_action_taken_by_id_fkey" FOREIGN KEY ("action_taken_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
