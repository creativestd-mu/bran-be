-- Persist spoken assignee names and learned name-resolution preferences.
ALTER TABLE "WorkUnit" ADD COLUMN "assigneeSpokenName" VARCHAR(200);
ALTER TABLE "WorkStep" ADD COLUMN "assigneeSpokenName" VARCHAR(200);

CREATE TABLE "NameAssignmentPreference" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "nameKey" VARCHAR(200) NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NameAssignmentPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NameAssignmentPreference_ownerUserId_nameKey_key"
  ON "NameAssignmentPreference"("ownerUserId", "nameKey");

CREATE INDEX "NameAssignmentPreference_ownerUserId_idx"
  ON "NameAssignmentPreference"("ownerUserId");

ALTER TABLE "NameAssignmentPreference"
  ADD CONSTRAINT "NameAssignmentPreference_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "NameAssignmentPreference"
  ADD CONSTRAINT "NameAssignmentPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
