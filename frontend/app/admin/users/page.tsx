"use client";

import { Fragment, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminUserListItem,
  CreatableAdminRole,
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { PaginationFooter } from "../pagination-footer";
import { TableRowsSkeleton } from "../skeleton";

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "door_staff" as CreatableAdminRole,
};

export default function AdminUsersPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function load() {
      if (!session) return;
      try {
        const { users: list, total: listTotal } = await listAdminUsers({
          page,
          pageSize: PAGE_SIZE,
        });
        if (!cancelled) {
          setUsers(list);
          setTotal(listTotal);
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
  }, [session, page, reloadKey]);

  function startEdit(user: AdminUserListItem) {
    setEditingId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role as CreatableAdminRole,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateAdminUser(editingId, {
          name: form.name,
          email: form.email,
          role: form.role,
        });
        toast.success(`${form.name} updated.`);
      } else {
        await createAdminUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        });
        toast.success(`Account created for ${form.email}.`);
      }
      resetForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.body.message
          : `Failed to ${editingId ? "update" : "create"} account.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(user: AdminUserListItem) {
    if (!session) return;
    setDeleting(true);
    try {
      await deleteAdminUser(user.id);
      toast.success(`${user.name} removed.`);
      setDeleteConfirmId(null);
      if (editingId === user.id) resetForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || !session) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors mb-6"
      >
        ← Back to registrations
      </Link>

      <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest mb-6">Admin & door staff accounts</h1>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="border border-emerald/20 rounded-2xl bg-white p-6 mb-8 flex flex-col gap-4 shadow-sm"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>
          {!editingId && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Temporary password</span>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Role</span>
            <select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value as CreatableAdminRole }))
              }
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            >
              <option value="door_staff">Door staff (check-in only)</option>
              <option value="organizer">Organizer (full access)</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="self-start bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : editingId ? "Save changes" : "Create account"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-sage underline"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="border border-emerald/20 rounded-2xl bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!usersLoaded && <TableRowsSkeleton rows={3} cols={5} />}
            {users.map((u) => {
              const isSelf = u.id === session.user.id;
              const isSuperAdmin = u.role === "super_admin";
              return (
                <Fragment key={u.id}>
                  <tr className="border-b border-emerald/20 last:border-0">
                    <td className="px-4 py-2">{u.name}</td>
                    <td className="px-4 py-2 text-sage">{u.email}</td>
                    <td className="px-4 py-2 font-mono text-xs">{u.role}</td>
                    <td className="px-4 py-2">
                      {u.mustChangePassword ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-gold/10 text-gold-deep">
                          Awaiting first login
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald/10 text-emerald">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {isSuperAdmin ? (
                        <span className="text-xs text-sage">—</span>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(u)}
                            className="text-sm text-ink underline mr-3"
                          >
                            Edit
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => setDeleteConfirmId(u.id)}
                              className="text-sm text-coral-deep underline"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                  {deleteConfirmId === u.id && (
                    <tr className="border-b border-emerald/20 last:border-0">
                      <td colSpan={5} className="px-4 py-3 bg-coral/10">
                        <div className="flex items-center gap-3">
                          <p className="text-sm">Remove {u.name}&apos;s account? This cannot be undone.</p>
                          <button
                            disabled={deleting}
                            onClick={() => void handleDelete(u)}
                            className="bg-coral-deep text-white px-3 py-1 rounded-full text-sm hover:bg-gold-deep transition-colors disabled:opacity-50"
                          >
                            Confirm delete
                          </button>
                          <button
                            disabled={deleting}
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-sm text-sage underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationFooter page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </main>
  );
}
