-- CreateTable
CREATE TABLE "email_broadcasts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "cta_label" TEXT,
    "cta_url" TEXT,
    "audience_json" JSONB NOT NULL,
    "recipient_count" INTEGER NOT NULL,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_broadcasts_event_id_created_at_idx" ON "email_broadcasts"("event_id", "created_at");

-- AddForeignKey
ALTER TABLE "email_broadcasts" ADD CONSTRAINT "email_broadcasts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
