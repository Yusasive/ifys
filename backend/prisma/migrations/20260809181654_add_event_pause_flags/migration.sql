-- AlterTable
ALTER TABLE "events" ADD COLUMN     "sponsorship_applications_paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ticket_purchasing_paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "volunteer_applications_paused" BOOLEAN NOT NULL DEFAULT false;
