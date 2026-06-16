-- CreateTable
CREATE TABLE "Vision" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "horizon" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "originalFilename" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storagePath" VARCHAR(1000) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisionTeam" (
    "visionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "VisionTeam_pkey" PRIMARY KEY ("visionId","teamId")
);

-- CreateTable
CREATE TABLE "VisionUser" (
    "visionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "VisionUser_pkey" PRIMARY KEY ("visionId","userId")
);

-- CreateIndex
CREATE INDEX "Vision_horizon_idx" ON "Vision"("horizon");

-- CreateIndex
CREATE INDEX "Vision_scope_idx" ON "Vision"("scope");

-- CreateIndex
CREATE INDEX "Vision_startsAt_endsAt_idx" ON "Vision"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Vision_createdById_idx" ON "Vision"("createdById");

-- CreateIndex
CREATE INDEX "VisionTeam_teamId_idx" ON "VisionTeam"("teamId");

-- CreateIndex
CREATE INDEX "VisionUser_userId_idx" ON "VisionUser"("userId");

-- AddForeignKey
ALTER TABLE "Vision" ADD CONSTRAINT "Vision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VisionTeam" ADD CONSTRAINT "VisionTeam_visionId_fkey" FOREIGN KEY ("visionId") REFERENCES "Vision"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VisionTeam" ADD CONSTRAINT "VisionTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VisionUser" ADD CONSTRAINT "VisionUser_visionId_fkey" FOREIGN KEY ("visionId") REFERENCES "Vision"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VisionUser" ADD CONSTRAINT "VisionUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
