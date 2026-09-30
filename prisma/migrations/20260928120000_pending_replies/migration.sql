-- Per-user Slack OAuth grant. Tokens are encrypted by the application.
CREATE TABLE "SlackConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slackUserId" VARCHAR(100) NOT NULL,
    "teamId" VARCHAR(100),
    "teamName" VARCHAR(300),
    "accessToken" TEXT NOT NULL,
    "scopes" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "errorMessage" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PendingReply" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "conversationExternalId" VARCHAR(500) NOT NULL,
    "conversationKind" VARCHAR(30) NOT NULL,
    "senderExternalId" VARCHAR(200),
    "senderName" VARCHAR(500),
    "senderAddress" VARCHAR(500),
    "subject" VARCHAR(1000),
    "snippet" TEXT,
    "channelId" VARCHAR(200),
    "channelName" VARCHAR(500),
    "threadTs" VARCHAR(100),
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingReply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlackConnection_userId_key" ON "SlackConnection"("userId");
CREATE UNIQUE INDEX "SlackConnection_slackUserId_key" ON "SlackConnection"("slackUserId");
CREATE INDEX "SlackConnection_status_idx" ON "SlackConnection"("status");
CREATE UNIQUE INDEX "PendingReply_userId_source_conversationExternalId_key" ON "PendingReply"("userId", "source", "conversationExternalId");
CREATE INDEX "PendingReply_userId_lastMessageAt_idx" ON "PendingReply"("userId", "lastMessageAt");
CREATE INDEX "PendingReply_userId_source_idx" ON "PendingReply"("userId", "source");

ALTER TABLE "SlackConnection" ADD CONSTRAINT "SlackConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "PendingReply" ADD CONSTRAINT "PendingReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
