-- Organizers carry an explicit permission snapshot (see AdminUser.permissions),
-- so a key added to the organizer defaults never reaches them on its own.
-- Grant the new certificates permission to every organizer that has a
-- snapshot, and make sure none of them is missing the name tags permission.
UPDATE "admin_users"
SET "permissions" = array_append("permissions", 'certificates.manage')
WHERE "role" = 'organizer'
  AND cardinality("permissions") > 0
  AND NOT ('certificates.manage' = ANY("permissions"));

UPDATE "admin_users"
SET "permissions" = array_append("permissions", 'tags.manage')
WHERE "role" = 'organizer'
  AND cardinality("permissions") > 0
  AND NOT ('tags.manage' = ANY("permissions"));
