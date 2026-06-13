-- Platform-wide voice recording archive linked to work units
CREATE TABLE IF NOT EXISTS "VoiceRecording" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "originalFilename" VARCHAR(500) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "storagePath" VARCHAR(1000) NOT NULL,
  "transcript" TEXT,
  "sarvamRequestId" VARCHAR(200),
  "languageCode" VARCHAR(20),
  "languageProbability" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VoiceRecording_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VoiceRecording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "VoiceRecording_userId_idx" ON "VoiceRecording"("userId");
CREATE INDEX IF NOT EXISTS "VoiceRecording_userId_createdAt_idx" ON "VoiceRecording"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "VoiceRecording_source_idx" ON "VoiceRecording"("source");

ALTER TABLE "WorkUnit" ADD COLUMN IF NOT EXISTS "audioRecordingId" TEXT;
CREATE INDEX IF NOT EXISTS "WorkUnit_audioRecordingId_idx" ON "WorkUnit"("audioRecordingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkUnit_audioRecordingId_fkey'
  ) THEN
    ALTER TABLE "WorkUnit"
      ADD CONSTRAINT "WorkUnit_audioRecordingId_fkey"
      FOREIGN KEY ("audioRecordingId") REFERENCES "VoiceRecording"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
