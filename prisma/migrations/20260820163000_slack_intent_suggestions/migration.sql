-- CreateTable
CREATE TABLE "SlackIntentSuggestion" (
    "id" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "branUserId" TEXT,
    "channelId" TEXT NOT NULL,
    "channelType" TEXT,
    "threadTs" TEXT,
    "messageTs" TEXT NOT NULL,
    "replyTs" TEXT,
    "originalText" TEXT NOT NULL,
    "eventType" TEXT,
    "isDm" BOOLEAN NOT NULL DEFAULT false,
    "candidatesJson" TEXT NOT NULL,
    "chosenIntent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackIntentSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackIntentExample" (
    "id" TEXT NOT NULL,
    "ownerBranUserId" TEXT,
    "normalizedQuery" VARCHAR(500) NOT NULL,
    "intent" VARCHAR(64) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackIntentExample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlackIntentSuggestion_createdAt_idx" ON "SlackIntentSuggestion"("createdAt");

-- CreateIndex
CREATE INDEX "SlackIntentSuggestion_status_createdAt_idx" ON "SlackIntentSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SlackIntentSuggestion_slackUserId_status_idx" ON "SlackIntentSuggestion"("slackUserId", "status");

-- CreateIndex
CREATE INDEX "SlackIntentSuggestion_branUserId_idx" ON "SlackIntentSuggestion"("branUserId");

-- CreateIndex
CREATE INDEX "SlackIntentExample_intent_idx" ON "SlackIntentExample"("intent");

-- CreateIndex
CREATE INDEX "SlackIntentExample_createdAt_idx" ON "SlackIntentExample"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlackIntentExample_normalizedQuery_key" ON "SlackIntentExample"("normalizedQuery");

-- AddForeignKey
ALTER TABLE "SlackIntentSuggestion" ADD CONSTRAINT "SlackIntentSuggestion_branUserId_fkey" FOREIGN KEY ("branUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SlackIntentExample" ADD CONSTRAINT "SlackIntentExample_ownerBranUserId_fkey" FOREIGN KEY ("ownerBranUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
