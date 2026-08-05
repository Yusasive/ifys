export type NavItem = {
  href: string;
  label: string;
  organizerOnly?: boolean;
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/users", label: "Staff accounts", organizerOnly: true },
  { href: "/admin/speakers", label: "Speakers", organizerOnly: true },
  { href: "/admin/sponsors", label: "Partners & Sponsors", organizerOnly: true },
  { href: "/admin/tickets", label: "Tickets", organizerOnly: true },
  { href: "/admin/coupons", label: "Coupons", organizerOnly: true },
  { href: "/admin/newsletter", label: "Newsletter", organizerOnly: true },
  { href: "/admin/volunteers", label: "Volunteers", organizerOnly: true },
];

export const ADMIN_NAV_FOOTER_ITEMS: NavItem[] = [
  { href: "/checkin", label: "Check-in", organizerOnly: true },
];
