-- Destructive reset: remove dummy Content (+ cascaded nodes) and Projects before Pods.
-- WorkUnit.projectId becomes NULL via existing ON DELETE SET NULL.

DELETE FROM "Content";
DELETE FROM "Project";

-- CreateTable
CREATE TABLE "Pod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "verticalId" TEXT NOT NULL,
    "headUserId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodSocialAccount" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "platformAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodSocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodSocialPost" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "caption" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "metrics" JSONB,
    "rawPayload" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodSocialPost_pkey" PRIMARY KEY ("id")
);

-- AlterTable Project: verticalId -> podId
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_verticalId_fkey";
DROP INDEX IF EXISTS "Project_verticalId_idx";
ALTER TABLE "Project" DROP COLUMN "verticalId";
ALTER TABLE "Project" ADD COLUMN "podId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Pod_verticalId_idx" ON "Pod"("verticalId");
CREATE INDEX "Pod_headUserId_idx" ON "Pod"("headUserId");
CREATE INDEX "Pod_name_idx" ON "Pod"("name");
CREATE INDEX "Pod_isActive_idx" ON "Pod"("isActive");

CREATE INDEX "PodSocialAccount_podId_idx" ON "PodSocialAccount"("podId");
CREATE INDEX "PodSocialAccount_kind_idx" ON "PodSocialAccount"("kind");
CREATE INDEX "PodSocialAccount_platform_idx" ON "PodSocialAccount"("platform");
CREATE INDEX "PodSocialAccount_isActive_idx" ON "PodSocialAccount"("isActive");
CREATE INDEX "PodSocialAccount_lastSyncedAt_idx" ON "PodSocialAccount"("lastSyncedAt");
CREATE UNIQUE INDEX "PodSocialAccount_podId_kind_platform_handle_key" ON "PodSocialAccount"("podId", "kind", "platform", "handle");

CREATE INDEX "PodSocialPost_accountId_idx" ON "PodSocialPost"("accountId");
CREATE INDEX "PodSocialPost_publishedAt_idx" ON "PodSocialPost"("publishedAt");
CREATE INDEX "PodSocialPost_syncedAt_idx" ON "PodSocialPost"("syncedAt");
CREATE UNIQUE INDEX "PodSocialPost_accountId_platformPostId_key" ON "PodSocialPost"("accountId", "platformPostId");

CREATE INDEX "Project_podId_idx" ON "Project"("podId");

-- AddForeignKey
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Pod" ADD CONSTRAINT "Pod_headUserId_fkey" FOREIGN KEY ("headUserId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "PodSocialAccount" ADD CONSTRAINT "PodSocialAccount_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "PodSocialPost" ADD CONSTRAINT "PodSocialPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PodSocialAccount"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "Project" ADD CONSTRAINT "Project_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
