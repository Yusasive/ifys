import { PermissionKey } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  organizerOnly?: boolean;
  superAdminOnly?: boolean;
  permission?: PermissionKey;
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview" },
  {
    href: "/admin/registrations",
    label: "Registrations",
    permission: "registrations.view",
  },
  {
    href: "/admin/messages",
    label: "Email participants",
    organizerOnly: true,
    permission: "messaging.send",
  },
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
    href: "/admin/tags",
    label: "Name tags",
    organizerOnly: true,
    permission: "tags.manage",
  },
  {
    href: "/admin/certificates",
    label: "Certificates",
    organizerOnly: true,
    permission: "certificates.manage",
  },
  {
    href: "/admin/feedback",
    label: "Feedback",
    organizerOnly: true,
    permission: "feedback.view",
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
