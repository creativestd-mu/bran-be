-- Align live DB with Prisma schema drift:
-- 1) AdhocWork.userId FK: ON UPDATE CASCADE -> NO ACTION
-- 2) escalations.title: TEXT -> VARCHAR(500)

-- DropForeignKey
ALTER TABLE "AdhocWork" DROP CONSTRAINT "AdhocWork_userId_fkey";

-- AlterTable
ALTER TABLE "escalations" ALTER COLUMN "title" SET DATA TYPE VARCHAR(500);

-- AddForeignKey
ALTER TABLE "AdhocWork" ADD CONSTRAINT "AdhocWork_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
