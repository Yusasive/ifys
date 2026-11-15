import { AdminRole } from '../generated/prisma/enums';

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
  'messaging.send',
  'ticketSettings.manage',
  'sponsors.manage',
  'speakers.manage',
  'tags.manage',
  'certificates.manage',
  'feedback.view',
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
  'messaging.send',
  'ticketSettings.manage',
  'sponsors.manage',
  'speakers.manage',
  'tags.manage',
  'certificates.manage',
  'feedback.view',
  'volunteers.manage',
  'newsletter.manage',
  'coupons.manage',
  'eventSettings.manage',
  'checkin.scan',
];

const DOOR_STAFF_PERMISSIONS: PermissionKey[] = ['checkin.scan'];

export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRole, PermissionKey[]> = {
  organizer: ORGANIZER_PERMISSIONS,
  door_staff: DOOR_STAFF_PERMISSIONS,
  super_admin: ALL_PERMISSIONS,
};

export function getEffectivePermissions(user: {
  role: AdminRole;
  permissions: string[];
}): PermissionKey[] {
  if (user.role === 'super_admin') {
    return ALL_PERMISSIONS;
  }
  if (user.permissions.length > 0) {
    return user.permissions.filter(isPermissionKey);
  }
  return ROLE_DEFAULT_PERMISSIONS[user.role];
}
