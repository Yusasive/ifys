-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('percent', 'fixed');

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "coupon_id" TEXT,
ADD COLUMN     "discount_applied_kobo" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ticket_products" ADD COLUMN     "card_note" TEXT,
ADD COLUMN     "card_price_label" TEXT,
ADD COLUMN     "discount_expires_at" TIMESTAMP(3),
ADD COLUMN     "discount_percent" INTEGER;

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discount_type" "CouponDiscountType" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "max_redemptions" INTEGER,
    "redemption_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_event_id_code_key" ON "coupons"("event_id", "code");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
