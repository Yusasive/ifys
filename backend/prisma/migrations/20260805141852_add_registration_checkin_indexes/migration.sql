-- CreateIndex
CREATE INDEX "check_ins_ticket_id_idx" ON "check_ins"("ticket_id");

-- CreateIndex
CREATE INDEX "registrations_status_idx" ON "registrations"("status");

-- CreateIndex
CREATE INDEX "registrations_created_at_idx" ON "registrations"("created_at");

-- CreateIndex
CREATE INDEX "registrations_ticket_product_id_idx" ON "registrations"("ticket_product_id");

-- CreateIndex
CREATE INDEX "registrations_coupon_id_idx" ON "registrations"("coupon_id");
