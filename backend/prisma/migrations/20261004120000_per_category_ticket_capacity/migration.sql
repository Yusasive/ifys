-- CreateTable
CREATE TABLE "category_capacities" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "category_capacities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_capacities_event_id_category_key" ON "category_capacities"("event_id", "category");

-- AddForeignKey
ALTER TABLE "category_capacities" ADD CONSTRAINT "category_capacities_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the initial per-category limits for every existing event.
INSERT INTO "category_capacities" ("id", "event_id", "category", "capacity")
SELECT gen_random_uuid()::text, e."id", c."category"::"Category", c."capacity"
FROM "events" e
CROSS JOIN (VALUES ('student', 40), ('regular', 60), ('professional', 60)) AS c("category", "capacity");

-- The single event-wide limit is replaced by the per-category limits above.
ALTER TABLE "events" DROP COLUMN "ticket_capacity";
