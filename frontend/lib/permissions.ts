import type { AdminRole } from "./admin-api";

// Mirrors backend/src/auth/permissions.ts — keep in sync (same duplication
// pattern already used for label maps between backend/src/email/labels.ts
// and this codebase's frontend format helpers).
export const PERMISSION_KEYS = [
  "registrations.view",
  "registrations.markPaid",
  "registrations.resendTicket",
  "registrations.voidTicket",
  "registrations.reissueTicket",
  "registrations.restoreTicket",
  "registrations.withdrawTicket",
  "registrations.cancel",
  "registrations.approveStudent",
  "registrations.rejectStudent",
  "registrations.sendReminder",
  "messaging.send",
  "ticketSettings.manage",
  "sponsors.manage",
  "speakers.manage",
  "tags.manage",
  "certificates.manage",
  "volunteers.manage",
  "newsletter.manage",
  "coupons.manage",
  "eventSettings.manage",
  "auditLog.view",
  "checkin.scan",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const ORGANIZER_PERMISSIONS: PermissionKey[] = [
  "registrations.view",
  "registrations.markPaid",
  "registrations.resendTicket",
  "registrations.voidTicket",
  "registrations.reissueTicket",
  "registrations.restoreTicket",
  "registrations.withdrawTicket",
  "registrations.cancel",
  "registrations.approveStudent",
  "registrations.rejectStudent",
  "registrations.sendReminder",
  "messaging.send",
  "ticketSettings.manage",
  "sponsors.manage",
  "speakers.manage",
  "tags.manage",
  "certificates.manage",
  "volunteers.manage",
  "newsletter.manage",
  "coupons.manage",
  "eventSettings.manage",
  "checkin.scan",
];

const DOOR_STAFF_PERMISSIONS: PermissionKey[] = ["checkin.scan"];

export const ROLE_DEFAULT_PERMISSIONS: Record<AdminRole, PermissionKey[]> = {
  organizer: ORGANIZER_PERMISSIONS,
  door_staff: DOOR_STAFF_PERMISSIONS,
  super_admin: [...PERMISSION_KEYS],
};

// Grouped for the permission checkbox grid on the admin-users create/edit
// forms.
export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  {
    label: "Registrations & tickets",
    keys: [
      "registrations.view",
      "registrations.markPaid",
      "registrations.resendTicket",
      "registrations.voidTicket",
      "registrations.reissueTicket",
      "registrations.restoreTicket",
      "registrations.withdrawTicket",
      "registrations.cancel",
      "registrations.approveStudent",
      "registrations.rejectStudent",
      "registrations.sendReminder",
    "messaging.send",
    ],
  },
  {
    label: "Content & settings",
    keys: [
      "ticketSettings.manage",
      "sponsors.manage",
      "speakers.manage",
      "tags.manage",
      "certificates.manage",
      "volunteers.manage",
      "newsletter.manage",
      "coupons.manage",
      "eventSettings.manage",
    ],
  },
  {
    label: "Other",
    keys: ["auditLog.view", "checkin.scan"],
  },
];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "registrations.view": "View registrations",
  "registrations.markPaid": "Mark registrations as paid",
  "registrations.resendTicket": "Resend tickets",
  "registrations.voidTicket": "Void tickets",
  "registrations.reissueTicket": "Reissue tickets",
  "registrations.restoreTicket": "Restore voided tickets",
  "registrations.withdrawTicket": "Withdraw reissued tickets",
  "registrations.cancel": "Cancel registrations",
  "registrations.approveStudent": "Approve student registrations",
  "registrations.rejectStudent": "Reject student registrations",
  "registrations.sendReminder": "Send payment reminders",
  "messaging.send": "Email participants (broadcast messages)",
  "ticketSettings.manage": "Manage ticket products & pricing",
  "sponsors.manage": "Manage sponsors & applications",
  "speakers.manage": "Manage speakers",
  "tags.manage": "Print name tags & manage organising team & VIPs",
  "certificates.manage": "Download & email participation certificates",
  "volunteers.manage": "Manage volunteer applications",
  "newsletter.manage": "Manage newsletter subscribers",
  "coupons.manage": "Manage coupons",
  "eventSettings.manage": "Manage event settings",
  "auditLog.view": "View system-wide audit log",
  "checkin.scan": "Scan tickets at check-in",
};

export function hasPermission(
  permissions: PermissionKey[] | undefined,
  permission: PermissionKey,
): boolean {
  return !!permissions?.includes(permission);
}
