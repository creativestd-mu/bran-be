-- Add createdById to WorkUnit (tracks who created a work unit on behalf of another user)
ALTER TABLE "WorkUnit" ADD COLUMN "createdById" TEXT;
ALTER TABLE "WorkUnit" ADD CONSTRAINT "WorkUnit_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "WorkUnit_createdById_idx" ON "WorkUnit"("createdById");

-- Add assigneeId to WorkStep (tracks who is responsible for a specific step)
ALTER TABLE "WorkStep" ADD COLUMN "assigneeId" TEXT;
ALTER TABLE "WorkStep" ADD CONSTRAINT "WorkStep_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "WorkStep_assigneeId_idx" ON "WorkStep"("assigneeId");
