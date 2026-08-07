"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { AdminSidebarNav } from "./admin-sidebar";

function BrandLink() {
  return (
    <Link href="/admin" className="block">
      <Image src="/logo1.png" alt="IFY Summit" width={949} height={290} className="h-8 w-auto" priority />
    </Link>
  );
}

function SignOutFooter() {
  const { session, logout } = useAdminAuth();
  const router = useRouter();

  if (!session) return null;

  function handleLogout() {
    logout();
    router.replace("/admin/login");
  }

  return (
    <div className="pt-4 border-t border-line text-sm">
      <p className="font-mono text-xs uppercase tracking-wide text-muted mb-2">
        {session.user.name} · {session.user.role}
      </p>
      <button
        onClick={handleLogout}
        className="text-rust hover:text-coral-deep transition-colors underline underline-offset-2"
      >
        Sign out
      </button>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("overflow-hidden");
    };
  }, [drawerOpen]);

  if (loading || !session) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:shrink-0 md:h-screen md:sticky md:top-0 border-r border-line border-t-4 border-t-gold bg-paper-2 px-4 py-6">
        <div className="mb-2">
          <BrandLink />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-rust mb-6">
          Operations dashboard
        </p>
        <AdminSidebarNav role={session?.user.role} />
        <SignOutFooter />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between border-b border-line border-t-4 border-t-gold px-4 py-3 bg-paper-2">
        <BrandLink />
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="text-2xl leading-none text-forest px-2"
        >
          ☰
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] bg-paper-2 border-r border-line px-4 py-6 flex flex-col transition-transform duration-200">
            <div className="flex items-center justify-between mb-6">
              <BrandLink />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="text-2xl leading-none text-ink px-2"
              >
                ✕
              </button>
            </div>
            <AdminSidebarNav role={session?.user.role} onNavigate={() => setDrawerOpen(false)} />
            <SignOutFooter />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
