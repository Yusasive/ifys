-- CreateTable
CREATE TABLE "vip_guests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "title" TEXT,
    "organization" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_guests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vip_guests_event_id_idx" ON "vip_guests"("event_id");

-- AddForeignKey
ALTER TABLE "vip_guests" ADD CONSTRAINT "vip_guests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
