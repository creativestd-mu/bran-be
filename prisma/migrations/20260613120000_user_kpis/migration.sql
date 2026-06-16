-- CreateTable
CREATE TABLE "UserKpi" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKpi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserKpi_userId_idx" ON "UserKpi"("userId");

-- CreateIndex
CREATE INDEX "UserKpi_createdById_idx" ON "UserKpi"("createdById");

-- CreateIndex
CREATE INDEX "UserKpi_userId_isActive_idx" ON "UserKpi"("userId", "isActive");

-- CreateIndex
CREATE INDEX "UserKpi_userId_sortOrder_idx" ON "UserKpi"("userId", "sortOrder");

-- AddForeignKey
ALTER TABLE "UserKpi" ADD CONSTRAINT "UserKpi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserKpi" ADD CONSTRAINT "UserKpi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
