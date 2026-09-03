import { PermissionKey } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  organizerOnly?: boolean;
  superAdminOnly?: boolean;
  // Checked in addition to (not instead of) the role gates above — lets a
  // super_admin hide a section for a specific organizer/door_staff even
  // though their role would normally see it.
  permission?: PermissionKey;
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview" },
  {
    href: "/admin/registrations",
    label: "Registrations",
    permission: "registrations.view",
  },
  // Not gated by a permission key — admin-user management (viewable by
  // organizer, but only super_admin can create/edit/delete) is deliberately
  // not itself delegable via the permission system, to prevent an organizer
  // from ever granting themselves more access.
  { href: "/admin/users", label: "Staff accounts", organizerOnly: true },
  {
    href: "/admin/speakers",
    label: "Speakers",
    organizerOnly: true,
    permission: "speakers.manage",
  },
  {
    href: "/admin/sponsors",
    label: "Partners & Sponsors",
    organizerOnly: true,
    permission: "sponsors.manage",
  },
  {
    href: "/admin/tickets",
    label: "Tickets",
    organizerOnly: true,
    permission: "ticketSettings.manage",
  },
  {
    href: "/admin/coupons",
    label: "Coupons",
    organizerOnly: true,
    permission: "coupons.manage",
  },
  {
    href: "/admin/newsletter",
    label: "Newsletter",
    organizerOnly: true,
    permission: "newsletter.manage",
  },
  {
    href: "/admin/volunteers",
    label: "Volunteers",
    organizerOnly: true,
    permission: "volunteers.manage",
  },
  {
    href: "/admin/audit-log",
    label: "System Audit Log",
    permission: "auditLog.view",
  },
  { href: "/admin/my-activity", label: "My Activity" },
];

export const ADMIN_NAV_FOOTER_ITEMS: NavItem[] = [
  { href: "/checkin", label: "Check-in", organizerOnly: true },
];
