-- Baseline for the pre-existing `avatar` column.
-- The column already exists in the database (it was added out-of-band and never
-- recorded in a migration), so this migration is registered as already-applied via
-- `prisma migrate resolve --applied` and is NOT executed. It exists so the migration
-- history matches the live schema and future `prisma migrate dev` runs stop reporting
-- drift.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatar" TEXT;
