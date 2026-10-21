-- CreateEnum
CREATE TYPE "TicketEmailKind" AS ENUM ('ticket', 'date_update');

-- CreateEnum
CREATE TYPE "TicketEmailStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateTable
CREATE TABLE "ticket_email_deliveries" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "kind" "TicketEmailKind" NOT NULL,
    "status" "TicketEmailStatus" NOT NULL,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_email_deliveries_kind_status_idx" ON "ticket_email_deliveries"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_email_deliveries_ticket_id_kind_key" ON "ticket_email_deliveries"("ticket_id", "kind");

-- AddForeignKey
ALTER TABLE "ticket_email_deliveries" ADD CONSTRAINT "ticket_email_deliveries_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
