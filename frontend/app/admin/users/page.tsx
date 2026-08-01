"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminRole,
  AdminUserListItem,
  createAdminUser,
  listAdminUsers,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { AdminHeader } from "../admin-header";

export default function AdminUsersPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("door_staff");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function load() {
      if (!session) return;
      try {
        const { users: list } = await listAdminUsers(session.token);
        if (!cancelled) setUsers(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.body.message : "Failed to load users.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session, message]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await createAdminUser(session.token, { name, email, password, role });
      setMessage(`Account created for ${email}.`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("door_staff");
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !session) return null;

  return (
    <div>
      <AdminHeader />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/admin" className="text-sm text-muted underline mb-6 inline-block">
          ← Back to registrations
        </Link>

        <h1 className="font-display text-2xl mb-6">Admin & door staff accounts</h1>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="border border-line rounded-sm bg-white p-6 mb-8 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Temporary password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AdminRole)}
                className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
              >
                <option value="door_staff">Door staff (check-in only)</option>
                <option value="organizer">Organizer (full access)</option>
              </select>
            </label>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
          {message && <p className="text-sm text-emerald">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="self-start bg-ink text-paper font-medium px-6 py-2 rounded-sm disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="border border-line rounded-sm bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2 text-muted">{u.email}</td>
                  <td className="px-4 py-2 font-mono text-xs">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
