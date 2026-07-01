-- Persist the Notion OAuth access token per user (feature auth-003).
-- AlterTable
ALTER TABLE "User" ADD COLUMN "accessToken" TEXT;
