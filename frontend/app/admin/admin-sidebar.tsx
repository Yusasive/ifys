"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminRole } from "@/lib/admin-api";
import { ADMIN_NAV_FOOTER_ITEMS, ADMIN_NAV_ITEMS, NavItem } from "./admin-nav-items";

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={
        active
          ? "block px-3.5 py-2 rounded-full text-sm font-semibold bg-emerald text-white shadow-sm"
          : "block px-3.5 py-2 rounded-full text-sm text-ink hover:bg-gold/15 hover:text-forest transition-colors"
      }
    >
      {item.label}
    </Link>
  );
}

export function AdminSidebarNav({
  role,
  onNavigate,
}: {
  role?: AdminRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const canSeeOrganizerOnly = role === "organizer" || role === "super_admin";
  const canSeeSuperAdminOnly = role === "super_admin";
  const visible = (item: NavItem) =>
    (!item.organizerOnly || canSeeOrganizerOnly) &&
    (!item.superAdminOnly || canSeeSuperAdminOnly);
  const items = ADMIN_NAV_ITEMS.filter(visible);
  const footerItems = ADMIN_NAV_FOOTER_ITEMS.filter(visible);

  return (
    <nav className="flex flex-col gap-1 flex-1">
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
      {footerItems.length > 0 && (
        <div className="mt-auto pt-4 border-t border-emerald/20 flex flex-col gap-1">
          {footerItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </nav>
  );
}
