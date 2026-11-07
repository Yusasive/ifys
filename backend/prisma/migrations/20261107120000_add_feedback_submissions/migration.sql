-- CreateEnum
CREATE TYPE "FeedbackRole" AS ENUM ('attendee', 'speaker', 'sponsor');

-- CreateTable
CREATE TABLE "feedback_submissions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "role" "FeedbackRole" NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "answers_json" JSONB NOT NULL,
    "testimonial_consent" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_submissions_event_id_created_at_idx" ON "feedback_submissions"("event_id", "created_at");

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Organizers carry an explicit permission snapshot (see AdminUser.permissions),
-- so a new key never reaches them on its own. Grant feedback.view to every
-- organizer that has a snapshot.
UPDATE "admin_users"
SET "permissions" = array_append("permissions", 'feedback.view')
WHERE "role" = 'organizer'
  AND cardinality("permissions") > 0
  AND NOT ('feedback.view' = ANY("permissions"));
