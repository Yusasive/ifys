-- The summit moved from Nov 7 to Nov 5, 2026. The seed script was updated,
-- but production only runs `prisma migrate deploy` (never the seed), so the
-- live event row kept Nov 7 and every ticket PDF/email rendered that date.
--
-- Shift by exactly two days so the original start time is preserved, and
-- only touch the row if it still sits on Nov 7 (starts_at is stored in UTC;
-- 09:00 WAT on Nov 7 is 08:00 UTC, so the UTC date is Nov 7 either way).
UPDATE "events"
SET starts_at = starts_at - INTERVAL '2 days'
WHERE slug = 'ify-summit-2026'
  AND starts_at::date = DATE '2026-11-07';
