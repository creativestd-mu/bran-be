-- CreateTable
CREATE TABLE "attendance_policy_docs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "body_md" TEXT NOT NULL DEFAULT '',
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_policy_docs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "attendance_policy_docs" ADD CONSTRAINT "attendance_policy_docs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Seed singleton row
INSERT INTO "attendance_policy_docs" ("id", "body_md", "updated_at")
VALUES ('default', '', CURRENT_TIMESTAMP);
