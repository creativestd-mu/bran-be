-- Navigation analytics: nav search logs + per-user page visit counts

CREATE TABLE "NavSearchLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" VARCHAR(500) NOT NULL,
    "selectedPath" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavSearchLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPageVisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 1,
    "lastVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPageVisit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NavSearchLog_userId_createdAt_idx" ON "NavSearchLog"("userId", "createdAt");

CREATE UNIQUE INDEX "UserPageVisit_userId_path_key" ON "UserPageVisit"("userId", "path");
CREATE INDEX "UserPageVisit_userId_visitCount_idx" ON "UserPageVisit"("userId", "visitCount");
CREATE INDEX "UserPageVisit_userId_lastVisitedAt_idx" ON "UserPageVisit"("userId", "lastVisitedAt");

ALTER TABLE "NavSearchLog" ADD CONSTRAINT "NavSearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "UserPageVisit" ADD CONSTRAINT "UserPageVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
