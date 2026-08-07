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
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="min-h-screen flex items-center justify-center px-4 bg-forest">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-2xl p-8 bg-white shadow-xl border-t-4 border-gold"
      >
        <Image
          src="/logo1.png"
          alt="IFY Summit"
          width={949}
          height={290}
          className="h-10 w-auto mb-6"
          priority
        />
        <p className="font-mono text-xs uppercase tracking-widest text-rust mb-2">
          Islamic Finance Youth Summit 2026
        </p>
        <h1 className="font-bricolage font-bold text-2xl text-forest mb-1">Admin sign in</h1>
        <p className="text-sm text-muted mb-6">Operations dashboard</p>

        <label className="flex flex-col gap-1 mb-4">
          <span className="text-sm text-muted">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1 mb-6">
          <span className="text-sm text-muted">Password</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line rounded-xl px-3 py-2 pr-10 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-forest transition-colors"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M3 3l18 18" />
                  <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                  <path d="M9.88 5.09A9.77 9.77 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.16 4.24M6.6 6.6C4.13 8.14 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.24-.96" />
                </svg>
              )}
            </button>
          </div>
        </label>

        {error && <p className="text-sm text-rust mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-salmon text-white font-semibold py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
