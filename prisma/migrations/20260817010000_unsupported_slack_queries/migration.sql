-- CreateTable
CREATE TABLE "UnsupportedSlackQuery" (
    "id" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "branUserId" TEXT,
    "channelId" TEXT NOT NULL,
    "channelType" TEXT,
    "threadTs" TEXT,
    "messageTs" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "eventType" TEXT,
    "isDm" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnsupportedSlackQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnsupportedSlackQuery_channelId_messageTs_key" ON "UnsupportedSlackQuery"("channelId", "messageTs");
CREATE INDEX "UnsupportedSlackQuery_createdAt_idx" ON "UnsupportedSlackQuery"("createdAt");
CREATE INDEX "UnsupportedSlackQuery_status_createdAt_idx" ON "UnsupportedSlackQuery"("status", "createdAt");
CREATE INDEX "UnsupportedSlackQuery_branUserId_idx" ON "UnsupportedSlackQuery"("branUserId");

-- AddForeignKey
ALTER TABLE "UnsupportedSlackQuery" ADD CONSTRAINT "UnsupportedSlackQuery_branUserId_fkey" FOREIGN KEY ("branUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
