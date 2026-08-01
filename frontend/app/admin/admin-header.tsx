"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";

export function AdminHeader() {
  const { session, logout } = useAdminAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/admin/login");
  }

  return (
    <header className="border-b border-line px-6 py-4 flex items-center justify-between bg-white">
      <div className="flex items-center gap-6">
        <Link href="/admin" className="font-display text-lg">
          IFY Summit — Operations
        </Link>
        {session?.user.role === "organizer" && (
          <Link href="/admin/users" className="text-sm text-muted underline">
            Staff accounts
          </Link>
        )}
      </div>
      {session && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted">
            {session.user.name} · {session.user.role}
          </span>
          <button onClick={handleLogout} className="text-ink underline">
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
