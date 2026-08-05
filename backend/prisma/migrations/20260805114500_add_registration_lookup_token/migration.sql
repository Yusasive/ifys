-- Add as nullable first so existing rows can be backfilled before the
-- NOT NULL + unique constraints are applied (prisma migrate dev refuses to
-- generate this automatically once the table has data).
ALTER TABLE "registrations" ADD COLUMN "lookup_token" TEXT;

UPDATE "registrations" SET "lookup_token" = gen_random_uuid()::text WHERE "lookup_token" IS NULL;

ALTER TABLE "registrations" ALTER COLUMN "lookup_token" SET NOT NULL;

CREATE UNIQUE INDEX "registrations_lookup_token_key" ON "registrations"("lookup_token");
