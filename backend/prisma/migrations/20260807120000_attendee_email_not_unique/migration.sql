-- AlterTable
ALTER TABLE "attendees" DROP CONSTRAINT "attendees_email_key";

-- CreateIndex
CREATE INDEX "attendees_email_idx" ON "attendees"("email");
