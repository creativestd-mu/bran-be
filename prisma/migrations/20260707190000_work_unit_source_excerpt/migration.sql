-- Map dictation transcript excerpts to work units and steps for inline tagging UI.
ALTER TABLE "WorkUnit" ADD COLUMN "sourceExcerpt" TEXT;
ALTER TABLE "WorkStep" ADD COLUMN "sourceExcerpt" TEXT;
