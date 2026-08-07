"use client";

import { useState } from "react";
import Link from "next/link";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApplicantsTab } from "./applicants-tab";
import { DirectoryTab } from "./directory-tab";

type Tab = "directory" | "applicants";

export default function AdminSponsorsPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [tab, setTab] = useState<Tab>("directory");

  if (authLoading || !session) return null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors mb-6"
      >
        ← Back to registrations
      </Link>

      <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest mb-6">Partners & Sponsors</h1>

      <div className="flex gap-2 border-b border-emerald/20 mb-6">
        <button
          type="button"
          onClick={() => setTab("directory")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "directory"
              ? "border-emerald text-emerald"
              : "border-transparent text-sage hover:text-ink"
          }`}
        >
          Directory
        </button>
        <button
          type="button"
          onClick={() => setTab("applicants")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "applicants"
              ? "border-emerald text-emerald"
              : "border-transparent text-sage hover:text-ink"
          }`}
        >
          Applicants
        </button>
      </div>

      {tab === "directory" ? <DirectoryTab /> : <ApplicantsTab />}
    </main>
  );
}
