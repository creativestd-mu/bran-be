-- CreateTable
CREATE TABLE "MeltwaterCompetitorContent" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "searchName" TEXT,
    "documentId" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "snippet" TEXT,
    "source" TEXT,
    "sourceName" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "sentiment" TEXT NOT NULL,
    "engagement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reach" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedViews" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "rawPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeltwaterCompetitorContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeltwaterCompetitorContent_searchId_documentId_key" ON "MeltwaterCompetitorContent"("searchId", "documentId");

-- CreateIndex
CREATE INDEX "MeltwaterCompetitorContent_searchId_sentiment_publishedAt_idx" ON "MeltwaterCompetitorContent"("searchId", "sentiment", "publishedAt");

-- CreateIndex
CREATE INDEX "MeltwaterCompetitorContent_publishedAt_idx" ON "MeltwaterCompetitorContent"("publishedAt");
