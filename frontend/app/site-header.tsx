"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/#about", label: "About" },
  { href: "/#speakers", label: "Speakers" },
  { href: "/#schedule", label: "Schedule" },
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader({
  showCta = true,
  showJoinTeam = true,
}: {
  showCta?: boolean;
  showJoinTeam?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white backdrop-blur-xl backdrop-saturate-150 border-b border-white/40 shadow-[0_8px_32px_-16px_rgba(16,32,29,0.35)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo1.png" alt="Islamic Finance Youth Summit" width={949} height={290} className="h-8 w-auto" priority />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-emerald/80 hover:text-emerald transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {showCta && (
          <div className="hidden md:flex items-center gap-3">
            {showJoinTeam && (
              <Link
                href="/volunteer"
                className="border border-emerald text-emerald font-semibold text-sm px-5 py-2.5 rounded-3xl hover:bg-emerald hover:text-white transition-colors"
              >
                Join our team
              </Link>
            )}
            <Link
              href="/register"
              className="bg-coral text-white font-semibold text-sm px-5 py-2.5 rounded-3xl hover:bg-coral-deep transition-colors"
            >
              Get Tickets
            </Link>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-emerald"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-white/40 bg-cloud/50 backdrop-blur-xl backdrop-saturate-150 px-4 py-4 flex flex-col gap-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-base font-medium text-emerald/80 hover:text-emerald transition-colors"
            >
              {link.label}
            </a>
          ))}
          {showCta && (
            <>
              {showJoinTeam && (
                <Link
                  href="/volunteer"
                  onClick={() => setOpen(false)}
                  className="border border-emerald text-emerald font-semibold text-sm px-5 py-3 rounded-sm text-center hover:bg-emerald hover:text-white transition-colors"
                >
                  Join our team
                </Link>
              )}
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="bg-coral text-white font-semibold text-sm px-5 py-3 rounded-sm text-center hover:bg-coral-deep transition-colors"
              >
                Get Tickets
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
