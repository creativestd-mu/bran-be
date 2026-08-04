-- CreateEnum
CREATE TYPE "PrereadMemberRole" AS ENUM ('viewer', 'editor');

-- AlterTable
ALTER TABLE "PrereadMember" ADD COLUMN "role" "PrereadMemberRole" NOT NULL DEFAULT 'viewer';
