"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminUser, fetchCurrentUser, logout as logoutRequest } from "./admin-api";
import { ApiError } from "./api";

interface AdminSession {
  user: AdminUser;
}

interface AdminAuthContextValue {
  session: AdminSession | null;
  loading: boolean;
  setSession: (session: AdminSession) => void;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const { user } = await fetchCurrentUser();
        if (!cancelled) setSessionState({ user });
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error("Failed to load admin session", err);
        }
        if (!cancelled) setSessionState(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  function setSession(next: AdminSession) {
    setSessionState(next);
  }

  function logout() {
    setSessionState(null);
    void logoutRequest().catch((err) => {
      console.error("Failed to revoke session on the server", err);
    });
  }

  return (
    <AdminAuthContext.Provider value={{ session, loading, setSession, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}

export function useRequireAdminAuth() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/admin/login");
      return;
    }
    if (session.user.mustChangePassword && pathname !== "/admin/change-password") {
      router.replace("/admin/change-password");
    }
  }, [loading, session, pathname, router]);

  return { session, loading };
}
