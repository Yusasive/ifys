"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminUserListItem,
  CreatableAdminRole,
  createAdminUser,
  listAdminUsers,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { TableRowsSkeleton } from "../skeleton";

export default function AdminUsersPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreatableAdminRole>("door_staff");
  const [submitting, setSubmitting] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const toast = useToast();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function load() {
      if (!session) return;
      try {
        const { users: list } = await listAdminUsers();
        if (!cancelled) {
          setUsers(list);
          setUsersLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.body.message : "Failed to load users.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, reloadKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    try {
      await createAdminUser({ name, email, password, role });
      toast.success(`Account created for ${email}.`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("door_staff");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !session) return null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-line rounded-full px-4 py-1.5 text-sm text-ink hover:bg-paper-2 transition-colors mb-6"
      >
        ← Back to registrations
      </Link>

      <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest mb-6">Admin & door staff accounts</h1>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="border border-line rounded-2xl bg-white p-6 mb-8 flex flex-col gap-4 shadow-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
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
                className="border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-muted">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as CreatableAdminRole)}
                className="border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              >
                <option value="door_staff">Door staff (check-in only)</option>
                <option value="organizer">Organizer (full access)</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="self-start bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="border border-line rounded-2xl bg-white overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {!usersLoaded && <TableRowsSkeleton rows={3} cols={3} />}
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
  );
}
