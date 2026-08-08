-- New "Regular" ticket product (both tiers) for every existing event, at
-- NGN 7,500 (750000 kobo). Mirrors the seed script's per-category loop.
INSERT INTO "ticket_products" (id, event_id, category, tier, price_kobo, currency, perks_json, is_active)
SELECT gen_random_uuid(), e.id, 'regular', t.tier, 750000, 'NGN', '{}'::jsonb, true
FROM "events" e
CROSS JOIN (VALUES ('standard'::"Tier"), ('premium'::"Tier")) AS t(tier)
ON CONFLICT (event_id, category, tier) DO NOTHING;

-- Founder is folded into "professional" (Professional/Founders/Entrepreneurs)
-- going forward — deactivate rather than delete so existing registrations
-- that reference these rows keep resolving.
UPDATE "ticket_products" SET is_active = false WHERE category = 'founder';
