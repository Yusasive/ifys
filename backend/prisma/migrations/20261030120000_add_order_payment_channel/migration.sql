-- AlterTable
ALTER TABLE "orders" ADD COLUMN "payment_channel" TEXT;

-- Backfill what is knowable without calling Paystack.
UPDATE "orders" SET "payment_channel" = 'free' WHERE "provider" = 'free' AND "status" = 'paid';
UPDATE "orders" SET "payment_channel" = 'manual' WHERE "provider_reference" LIKE 'manual-%' AND "status" = 'paid';
