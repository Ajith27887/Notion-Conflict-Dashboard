-- Persist the integration's Notion bot user id per user (bug-001 anti-loop).
-- Notion stamps this id on last_edited_by for the app's own resolve write-back
-- edits, so detection can tell a write-back landing apart from a human edit.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "botId" TEXT;
