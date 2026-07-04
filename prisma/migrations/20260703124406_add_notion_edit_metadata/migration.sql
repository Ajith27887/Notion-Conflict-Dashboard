-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN "notionLastEditedTime" TIMESTAMP(3),
ADD COLUMN "notionLastEditedBy" TEXT;

-- AlterTable
ALTER TABLE "Conflict" ADD COLUMN "sourceSnapshotId" INTEGER,
ADD COLUMN "resolvedContent" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Conflict_sourceSnapshotId_key" ON "Conflict"("sourceSnapshotId");
