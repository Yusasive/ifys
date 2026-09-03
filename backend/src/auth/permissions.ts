import { AdminRole } from '../generated/prisma/enums';

// Single source of truth for every granular admin capability. Adding a new
// key here never needs a migration — AdminUser.permissions is a plain
// Postgres text array, not a DB enum. Keep in sync with
// frontend/lib/permissions.ts (same duplication pattern already used for
// backend/src/email/labels.ts vs the frontend's label maps).
export const PERMISSION_KEYS = [
  'registrations.view',
  'registrations.markPaid',
  'registrations.resendTicket',
  'registrations.voidTicket',
  'registrations.reissueTicket',
  'registrations.restoreTicket',
  'registrations.withdrawTicket',
  'registrations.cancel',
  'registrations.approveStudent',
  'registrations.rejectStudent',
  'registrations.sendReminder',
  'ticketSettings.manage',
  'sponsors.manage',
  'speakers.manage',
  'volunteers.manage',
  'newsletter.manage',
  'coupons.manage',
  'eventSettings.manage',
  'auditLog.view',
  'checkin.scan',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isPermissionKey(value: unknown): value is PermissionKey {
  return (
    typeof value === 'string' &&
    (PERMISSION_KEYS as readonly string[]).includes(value)
  );
}

const ALL_PERMISSIONS = [...PERMISSION_KEYS];

const ORGANIZER_PERMISSIONS: PermissionKey[] = [
  'registrations.view',
  'registrations.markPaid',
  'registrations.resendTicket',
  'registrations.voidTicket',
  'registrations.reissueTicket',
  'registrations.restoreTicket',
  'registrations.withdrawTicket',
  'registrations.cancel',
  'registrations.approveStudent',
  'registrations.rejectStudent',
  'registrations.sendReminder',
  'ticketSettings.manage',
  'sponsors.manage',
  'speakers.manage',
  'volunteers.manage',
  'newsletter.manage',
  'coupons.manage',
  'eventSettings.manage',
  'checkin.scan',
  // Deliberately excluded: 'auditLog.view' — off by default even for
  // organizers, a super_admin can grant it per-person.
];

const DOOR_STAFF_PERMISSIONS: PermissionKey[] = ['checkin.scan'];

// Applied at AdminUser creation (unless the caller passes an explicit
// `permissions` array) and as the reset target when a super_admin changes
// someone's role without also specifying a new permission set.
export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRole, PermissionKey[]> = {
  organizer: ORGANIZER_PERMISSIONS,
  door_staff: DOOR_STAFF_PERMISSIONS,
  super_admin: ALL_PERMISSIONS,
};

// An empty `permissions` array means "inherit the role's defaults" — this
// is what every pre-existing AdminUser row resolves to after the migration
// (column defaults to `[]`), so there's no risky backfill and no deploy-day
// permission cliff. `createAdminUser` always writes an explicit snapshot,
// so a person's permissions are independently editable from then on.
export function getEffectivePermissions(user: {
  role: AdminRole;
  permissions: string[];
}): PermissionKey[] {
  if (user.permissions.length > 0) {
    return user.permissions.filter(isPermissionKey);
  }
  return ROLE_DEFAULT_PERMISSIONS[user.role];
}
