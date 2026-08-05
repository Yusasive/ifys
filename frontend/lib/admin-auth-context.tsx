"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    // The session lives in an httpOnly cookie the frontend can't read
    // directly — hydrate on load by asking the backend who (if anyone)
    // the current cookie belongs to.
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

// Redirects to /admin/login when there's no session once the initial
// /auth/me check has finished — avoids a flash-redirect before we've even
// checked whether a session exists.
export function useRequireAdminAuth() {
  const { session, loading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/admin/login");
    }
  }, [loading, session, router]);

  return { session, loading };
}
