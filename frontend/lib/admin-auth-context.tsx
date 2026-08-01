"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminUser } from "./admin-api";

const STORAGE_KEY = "ify-admin-session";

interface AdminSession {
  token: string;
  user: AdminUser;
}

interface AdminAuthContextValue {
  session: AdminSession | null;
  loading: boolean;
  setSession: (session: AdminSession) => void;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function readStoredSession(): AdminSession | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const stored = readStoredSession();
      if (!cancelled) {
        setSessionState(stored);
        setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  function setSession(next: AdminSession) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSessionState(next);
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSessionState(null);
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
// localStorage read has finished — avoids a flash-redirect before we've
// even checked whether a session exists.
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
