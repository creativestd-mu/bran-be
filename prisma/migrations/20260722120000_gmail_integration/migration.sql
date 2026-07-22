-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "oauthEmail" VARCHAR(320),
    "refreshToken" TEXT NOT NULL,
    "historyId" VARCHAR(100),
    "lastSyncedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "errorMessage" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailMessage" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "gmailMessageId" VARCHAR(200) NOT NULL,
    "threadId" VARCHAR(200),
    "subject" VARCHAR(1000),
    "fromAddress" VARCHAR(500),
    "toAddresses" TEXT,
    "snippet" TEXT,
    "bodyText" TEXT,
    "labelIds" TEXT,
    "receivedAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_userId_key" ON "GmailConnection"("userId");

-- CreateIndex
CREATE INDEX "GmailConnection_status_idx" ON "GmailConnection"("status");

-- CreateIndex
CREATE INDEX "GmailConnection_oauthEmail_idx" ON "GmailConnection"("oauthEmail");

-- CreateIndex
CREATE UNIQUE INDEX "GmailMessage_connectionId_gmailMessageId_key" ON "GmailMessage"("connectionId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "GmailMessage_connectionId_receivedAt_idx" ON "GmailMessage"("connectionId", "receivedAt");

-- CreateIndex
CREATE INDEX "GmailMessage_connectionId_createdAt_idx" ON "GmailMessage"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "GmailConnection" ADD CONSTRAINT "GmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "GmailMessage" ADD CONSTRAINT "GmailMessage_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GmailConnection"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
