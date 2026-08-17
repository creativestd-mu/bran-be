-- CreateTable
CREATE TABLE "TranscriptionKeyword" (
    "id" TEXT NOT NULL,
    "phrase" VARCHAR(200) NOT NULL,
    "normalized" VARCHAR(200) NOT NULL,
    "notes" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptionKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptionKeyword_normalized_key" ON "TranscriptionKeyword"("normalized");
CREATE INDEX "TranscriptionKeyword_isActive_idx" ON "TranscriptionKeyword"("isActive");
CREATE INDEX "TranscriptionKeyword_createdAt_idx" ON "TranscriptionKeyword"("createdAt");

-- AddForeignKey
ALTER TABLE "TranscriptionKeyword" ADD CONSTRAINT "TranscriptionKeyword_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
