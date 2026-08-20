-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "review_requests" (
    "id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "requested_to_id" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "file_url" TEXT,
    "storage_path" TEXT,
    "file_name" TEXT,
    "content_type" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "response_comment" TEXT,
    "responded_at" TIMESTAMP(3),
    "slack_channel_id" TEXT,
    "slack_message_ts" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reminder_preferences" (
    "user_id" TEXT NOT NULL,
    "times" TEXT[] DEFAULT ARRAY['11:00', '18:00']::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_reminded_slot" TEXT,
    "last_reminded_on" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_reminder_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "review_requests_requested_by_id_status_idx" ON "review_requests"("requested_by_id", "status");

-- CreateIndex
CREATE INDEX "review_requests_requested_to_id_status_idx" ON "review_requests"("requested_to_id", "status");

-- CreateIndex
CREATE INDEX "review_requests_status_created_at_idx" ON "review_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_requested_to_id_fkey" FOREIGN KEY ("requested_to_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_reminder_preferences" ADD CONSTRAINT "review_reminder_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
