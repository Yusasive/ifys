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
          <Image
            src="/logo1.png"
            alt="Islamic Finance Youth Summit"
            width={949}
            height={290}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-sans text-base font-normal leading-none tracking-normal text-center text-forest hover:text-emerald transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {showCta && (
          <div className="hidden lg:flex items-center gap-3">
            {showJoinTeam && (
              <Link
                href="/volunteer"
                className="flex items-center justify-center border border-salmon text-salmon font-sans font-medium text-sm lg:text-lg leading-none tracking-normal text-center px-5 py-2.5 lg:w-[170px] lg:h-[45px] lg:gap-[10px] rounded-3xl lg:rounded-[35px] hover:bg-salmon hover:text-white transition-colors"
              >
                Join our team
              </Link>
            )}
            <Link
              href="/register"
              className="flex items-center justify-center bg-salmon text-white font-sans font-medium text-sm lg:text-lg leading-none tracking-normal text-center px-5 py-2.5 lg:w-[170px] lg:h-[45px] lg:p-4 rounded-3xl lg:rounded-[35px] hover:bg-coral-deep transition-colors"
            >
              Get Tickets
            </Link>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden p-2 py-3.5 -mr-2 text-emerald"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-6 h-6"
          >
            {open ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 6l12 12M18 6L6 18"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 7h16M4 12h16M4 17h16"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-white/40 bg-cloud/50 backdrop-blur-xl backdrop-saturate-150 px-4 py-4 flex flex-col gap-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="font-sans text-base font-normal leading-none tracking-normal text-center text-forest hover:text-emerald transition-colors"
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
                  className="flex items-center justify-center w-full border border-salmon text-salmon font-sans font-medium text-base leading-none tracking-normal px-5 py-3 rounded-full text-center hover:bg-salmon hover:text-white transition-colors"
                >
                  Join our team
                </Link>
              )}
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-full bg-salmon text-white font-sans font-medium text-base leading-none tracking-normal px-5 py-3 rounded-full text-center hover:bg-coral-deep transition-colors"
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
