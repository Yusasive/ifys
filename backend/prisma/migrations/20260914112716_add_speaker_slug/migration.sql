-- Add a name-derived, unique slug for public speaker URLs.
ALTER TABLE "speakers" ADD COLUMN "slug" TEXT;

-- Backfill existing rows from their name, appending a short id suffix so
-- duplicate names (or names that slugify to the same value) can't collide.
UPDATE "speakers"
SET "slug" = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
  || '-' || substr(id, 1, 8);

ALTER TABLE "speakers" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "speakers_slug_key" ON "speakers"("slug");
