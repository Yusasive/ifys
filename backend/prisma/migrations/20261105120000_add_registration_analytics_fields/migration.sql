-- Analysis fields collected at registration. All nullable, so existing rows
-- and clients that don't send them are unaffected.
ALTER TABLE "registrations"
  ADD COLUMN "heard_from" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "age_range" TEXT,
  ADD COLUMN "attend_reason" TEXT,
  ADD COLUMN "industry" TEXT,
  ADD COLUMN "utm_source" TEXT,
  ADD COLUMN "utm_medium" TEXT,
  ADD COLUMN "utm_campaign" TEXT,
  ADD COLUMN "referrer" TEXT;

-- Industry was already collected, but only inside form_data_json.
UPDATE "registrations"
SET "industry" = NULLIF(BTRIM("form_data_json"->>'industry'), '')
WHERE "industry" IS NULL;

CREATE INDEX "registrations_heard_from_idx" ON "registrations"("heard_from");
