-- Swap the OrderProvider enum from {flutterwave} back to {paystack},
-- migrating existing rows rather than dropping them. amount_minor stays
-- as-is — that naming is provider-agnostic and correct regardless of
-- which provider is active.
ALTER TYPE "OrderProvider" ADD VALUE 'paystack';

-- Enum values added above cannot be used in the same transaction/command
-- batch that adds them on older Postgres, so this runs as its own
-- statement after the ADD VALUE has committed.
UPDATE "orders" SET "provider" = 'paystack' WHERE "provider" = 'flutterwave';

ALTER TABLE "orders" ALTER COLUMN "provider" DROP DEFAULT;

CREATE TYPE "OrderProvider_new" AS ENUM ('paystack');
ALTER TABLE "orders" ALTER COLUMN "provider" TYPE "OrderProvider_new" USING ("provider"::text::"OrderProvider_new");
ALTER TYPE "OrderProvider" RENAME TO "OrderProvider_old";
ALTER TYPE "OrderProvider_new" RENAME TO "OrderProvider";
DROP TYPE "OrderProvider_old";

ALTER TABLE "orders" ALTER COLUMN "provider" SET DEFAULT 'paystack';
