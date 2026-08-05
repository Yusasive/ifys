"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { login } from "@/lib/admin-api";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const { setSession } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await login(email, password);
      setSession({ user });
      router.replace(user.role === "door_staff" ? "/checkin" : "/admin");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many login attempts. Please wait a minute and try again.");
      } else {
        setError(err instanceof ApiError ? err.body.message : "Login failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm border border-line rounded-sm p-8 bg-white"
      >
        <Image
          src="/logo1.png"
          alt="IFY Summit"
          width={949}
          height={290}
          className="h-10 w-auto mb-6"
          priority
        />
        <h1 className="font-display text-2xl mb-1">Admin sign in</h1>
        <p className="text-sm text-muted mb-6">
          Islamic Finance Youth Summit 2026 operations
        </p>

        <label className="flex flex-col gap-1 mb-4">
          <span className="text-sm text-muted">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
          />
        </label>

        <label className="flex flex-col gap-1 mb-6">
          <span className="text-sm text-muted">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
          />
        </label>

        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ink text-paper font-medium py-2 rounded-sm disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
