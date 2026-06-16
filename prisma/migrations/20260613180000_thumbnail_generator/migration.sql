-- Thumbnail generator utility

CREATE TABLE "ThumbnailGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputTitle" VARCHAR(500) NOT NULL,
    "inputDescription" TEXT NOT NULL,
    "inputContext" TEXT,
    "referencePaths" TEXT NOT NULL,
    "outputTitle" VARCHAR(500) NOT NULL,
    "outputTextDescription" TEXT NOT NULL,
    "outputContext" TEXT NOT NULL,
    "assets" TEXT NOT NULL,
    "designBrief" TEXT NOT NULL,
    "styleFromReferences" TEXT NOT NULL,
    "generatedImagePath" VARCHAR(1000),
    "generatedMimeType" VARCHAR(100),
    "generatedFileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThumbnailGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ThumbnailGeneration_userId_createdAt_idx" ON "ThumbnailGeneration"("userId", "createdAt");

ALTER TABLE "ThumbnailGeneration" ADD CONSTRAINT "ThumbnailGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
