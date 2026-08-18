-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "pending_payment_reminder_sent_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_target_type_target_id_idx" ON "audit_log"("target_type", "target_id");
