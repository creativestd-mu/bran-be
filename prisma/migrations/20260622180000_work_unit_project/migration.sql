-- Link work units to projects.
ALTER TABLE "WorkUnit" ADD COLUMN "projectId" TEXT;

CREATE INDEX "WorkUnit_projectId_idx" ON "WorkUnit"("projectId");

ALTER TABLE "WorkUnit"
  ADD CONSTRAINT "WorkUnit_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
