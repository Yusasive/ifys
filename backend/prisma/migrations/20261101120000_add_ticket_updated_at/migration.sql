-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "tickets_updated_at_idx" ON "tickets"("updated_at");
