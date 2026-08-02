-- Rename amount_kobo -> amount_minor (still stores the amount in kobo
-- internally; the name change just stops implying a Paystack-only unit).
ALTER TABLE "orders" RENAME COLUMN "amount_kobo" TO "amount_minor";

-- Swap the OrderProvider enum from {paystack} to {flutterwave}, migrating
-- existing rows rather than dropping them.
ALTER TYPE "OrderProvider" ADD VALUE 'flutterwave';

-- Enum values added above cannot be used in the same transaction/command
-- batch that adds them on older Postgres, so this runs as its own
-- statement after the ADD VALUE has committed.
UPDATE "orders" SET "provider" = 'flutterwave' WHERE "provider" = 'paystack';

ALTER TABLE "orders" ALTER COLUMN "provider" DROP DEFAULT;

CREATE TYPE "OrderProvider_new" AS ENUM ('flutterwave');
ALTER TABLE "orders" ALTER COLUMN "provider" TYPE "OrderProvider_new" USING ("provider"::text::"OrderProvider_new");
ALTER TYPE "OrderProvider" RENAME TO "OrderProvider_old";
ALTER TYPE "OrderProvider_new" RENAME TO "OrderProvider";
DROP TYPE "OrderProvider_old";

ALTER TABLE "orders" ALTER COLUMN "provider" SET DEFAULT 'flutterwave';
