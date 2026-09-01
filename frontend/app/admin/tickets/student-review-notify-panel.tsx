"use client";

import { useEffect, useState } from "react";
import { AdminUserListItem, listAdminUsers, updateAdminUser } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";

// Notification recipients are organizer/door_staff accounts only —
// super_admin accounts can't be edited through PATCH /admin/users/:id
// (see AdminService.updateAdminUser), so they're left out of this list
// rather than shown as a toggle that would always fail to save.
export function StudentReviewNotifyPanel() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminUsers({ pageSize: 100 })
      .then(({ users: list }) => {
        if (!cancelled) {
          setUsers(list.filter((u) => u.role !== "super_admin"));
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.body.message : "Failed to load admins.");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(user: AdminUserListItem, checked: boolean) {
    setSavingId(user.id);
    try {
      const updated = await updateAdminUser(user.id, {
        notifyOnStudentRegistration: checked,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to update.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="border border-emerald/20 rounded-2xl bg-white px-6 py-4 shadow-sm mb-6">
      <p className="font-bricolage font-semibold text-forest mb-1">Student ticket review notifications</p>
      <p className="text-sm text-sage mb-4">
        These admins get emailed whenever a student ticket needs ID verification.
      </p>

      {!loaded && <p className="text-sm text-sage">Loading…</p>}
      {loaded && users.length === 0 && (
        <p className="text-sm text-sage">No organizer or door-staff accounts yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <label key={u.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-emerald"
              checked={u.notifyOnStudentRegistration}
              disabled={savingId === u.id}
              onChange={(e) => void toggle(u, e.target.checked)}
            />
            <span className="text-sm text-ink">{u.name}</span>
            <span className="text-sm text-sage">{u.email}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
