CREATE TABLE "ReplyConnectionPromptState" (
    "userId" TEXT NOT NULL,
    "messagesSincePrompt" INTEGER NOT NULL DEFAULT 0,
    "promptCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "lastPromptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplyConnectionPromptState_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "ReplyConnectionPromptState_lastPromptAt_idx"
ON "ReplyConnectionPromptState"("lastPromptAt");

ALTER TABLE "ReplyConnectionPromptState"
ADD CONSTRAINT "ReplyConnectionPromptState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;
