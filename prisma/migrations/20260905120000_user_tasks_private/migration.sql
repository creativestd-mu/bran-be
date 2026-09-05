-- Per-member work-unit privacy: peers/managers cannot browse their tasks.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tasksPrivate" BOOLEAN NOT NULL DEFAULT false;
