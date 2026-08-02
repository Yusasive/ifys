export type NavItem = {
  href: string;
  label: string;
  organizerOnly?: boolean;
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/users", label: "Staff accounts", organizerOnly: true },
];

export const ADMIN_NAV_FOOTER_ITEMS: NavItem[] = [
  { href: "/checkin", label: "Check-in", organizerOnly: true },
];
