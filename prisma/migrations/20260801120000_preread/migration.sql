-- CreateEnum
CREATE TYPE "PrereadNodeKind" AS ENUM ('output', 'blocker', 'advice');

-- CreateTable
CREATE TABLE "Preread" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrereadMember" (
    "prereadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrereadMember_pkey" PRIMARY KEY ("prereadId","userId")
);

-- CreateTable
CREATE TABLE "PrereadNode" (
    "id" TEXT NOT NULL,
    "prereadId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "PrereadNodeKind" NOT NULL DEFAULT 'output',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrereadNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrereadComment" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrereadComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrereadMedia" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrereadMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Preread_ownerId_idx" ON "Preread"("ownerId");

-- CreateIndex
CREATE INDEX "PrereadMember_userId_idx" ON "PrereadMember"("userId");

-- CreateIndex
CREATE INDEX "PrereadNode_prereadId_parentId_idx" ON "PrereadNode"("prereadId", "parentId");

-- CreateIndex
CREATE INDEX "PrereadNode_prereadId_orderIndex_idx" ON "PrereadNode"("prereadId", "orderIndex");

-- CreateIndex
CREATE INDEX "PrereadComment_nodeId_createdAt_idx" ON "PrereadComment"("nodeId", "createdAt");

-- CreateIndex
CREATE INDEX "PrereadMedia_nodeId_idx" ON "PrereadMedia"("nodeId");

-- AddForeignKey
ALTER TABLE "Preread" ADD CONSTRAINT "Preread_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PrereadMember" ADD CONSTRAINT "PrereadMember_prereadId_fkey" FOREIGN KEY ("prereadId") REFERENCES "Preread"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PrereadMember" ADD CONSTRAINT "PrereadMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PrereadNode" ADD CONSTRAINT "PrereadNode_prereadId_fkey" FOREIGN KEY ("prereadId") REFERENCES "Preread"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PrereadNode" ADD CONSTRAINT "PrereadNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PrereadNode"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PrereadComment" ADD CONSTRAINT "PrereadComment_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "PrereadNode"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PrereadComment" ADD CONSTRAINT "PrereadComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PrereadMedia" ADD CONSTRAINT "PrereadMedia_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "PrereadNode"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PrereadMedia" ADD CONSTRAINT "PrereadMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
