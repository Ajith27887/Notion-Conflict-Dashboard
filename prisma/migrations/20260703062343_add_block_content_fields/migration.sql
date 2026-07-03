-- AlterTable
ALTER TABLE "Conflict" ADD COLUMN     "user1Content" TEXT,
ADD COLUMN     "user2Content" TEXT;

-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "content" TEXT;
