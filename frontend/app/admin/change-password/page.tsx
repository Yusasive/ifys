"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/lib/admin-api";
import { useAdminAuth, useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";

export default function ChangePasswordPage() {
  const { session, loading } = useRequireAdminAuth();
  const { setSession } = useAdminAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading || !session) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await changePassword(currentPassword, newPassword);
      setSession({ user });
      router.replace(user.role === "door_staff" ? "/checkin" : "/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-forest">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-2xl p-8 bg-white shadow-xl border-t-4 border-gold"
      >
        <h1 className="font-bricolage font-bold text-2xl text-forest mb-1">Set a new password</h1>
        <p className="text-sm text-sage mb-6">
          {session.user.mustChangePassword
            ? "Your account was created with a temporary password. Set your own before continuing."
            : "Change your password."}
        </p>

        <label className="flex flex-col gap-1 mb-4">
          <span className="text-sm text-sage">Current password</span>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1 mb-4">
          <span className="text-sm text-sage">New password</span>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1 mb-6">
          <span className="text-sm text-sage">Confirm new password</span>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
          />
        </label>

        {error && <p className="text-sm text-coral-deep mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-salmon text-white font-semibold py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save password"}
        </button>
      </form>
    </main>
  );
}
