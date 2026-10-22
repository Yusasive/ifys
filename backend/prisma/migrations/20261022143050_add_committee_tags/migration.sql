-- CreateTable
CREATE TABLE "committee_positions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_members" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "committee_positions_event_id_name_key" ON "committee_positions"("event_id", "name");

-- CreateIndex
CREATE INDEX "committee_members_event_id_idx" ON "committee_members"("event_id");

-- AddForeignKey
ALTER TABLE "committee_positions" ADD CONSTRAINT "committee_positions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "committee_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Organizers carry an explicit permission snapshot (see AdminUser.permissions),
-- so a key added to the organizer defaults never reaches them on its own.
-- Grant the new tags permission to every organizer that has one.
UPDATE "admin_users"
SET "permissions" = array_append("permissions", 'tags.manage')
WHERE "role" = 'organizer'
  AND cardinality("permissions") > 0
  AND NOT ('tags.manage' = ANY("permissions"));
