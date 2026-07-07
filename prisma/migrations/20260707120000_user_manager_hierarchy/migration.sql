-- Add user-level reporting hierarchy.
ALTER TABLE "User" ADD COLUMN "managerUserId" TEXT;

CREATE INDEX "User_managerUserId_idx" ON "User"("managerUserId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_managerUserId_fkey"
  FOREIGN KEY ("managerUserId") REFERENCES "User"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
