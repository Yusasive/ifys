-- AlterEnum
ALTER TYPE "SponsorType" ADD VALUE 'exhibitor';

-- AlterTable
ALTER TABLE "sponsor_applications" ADD COLUMN "website_url" TEXT,
ADD COLUMN "budget_note" TEXT;
