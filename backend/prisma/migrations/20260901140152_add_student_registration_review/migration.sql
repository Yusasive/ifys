-- AlterEnum
ALTER TYPE "RegistrationStatus" ADD VALUE 'pending_review';

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "notify_on_student_registration" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "ticket_capacity" INTEGER NOT NULL DEFAULT 300;
