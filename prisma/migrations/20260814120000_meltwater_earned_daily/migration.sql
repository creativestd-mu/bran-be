-- CreateTable
CREATE TABLE "MeltwaterEarnedDaily" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "searchName" TEXT,
    "date" DATE NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "reach" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedViews" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sentimentPositive" INTEGER NOT NULL DEFAULT 0,
    "sentimentNeutral" INTEGER NOT NULL DEFAULT 0,
    "sentimentNegative" INTEGER NOT NULL DEFAULT 0,
    "sentimentUnknown" INTEGER NOT NULL DEFAULT 0,
    "rawPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeltwaterEarnedDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeltwaterEarnedDaily_searchId_date_timezone_key" ON "MeltwaterEarnedDaily"("searchId", "date", "timezone");

-- CreateIndex
CREATE INDEX "MeltwaterEarnedDaily_date_idx" ON "MeltwaterEarnedDaily"("date");

-- CreateIndex
CREATE INDEX "MeltwaterEarnedDaily_searchId_date_idx" ON "MeltwaterEarnedDaily"("searchId", "date");
