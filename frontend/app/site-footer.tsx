import Image from "next/image";

const EXPLORE_LINKS = [
  { href: "/#about", label: "About" },
  { href: "/#speakers", label: "Speakers" },
  { href: "/#schedule", label: "Agenda" },
  { href: "/#tickets", label: "Tickets" },
];

const MORE_LINKS = [
  { href: "/#faq", label: "FAQ" },
  { href: "/#sponsors", label: "Sponsors" },
  { href: "mailto:contact@ifysummit.com?subject=Join%20Our%20Team", label: "Join Our Team" },
];

const SOCIALS = [
  {
    label: "LinkedIn",
    href: "#",
    path: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.64h.05c.53-.97 1.83-2 3.77-2 4.03 0 4.78 2.53 4.78 5.83V21h-4v-5.6c0-1.34-.02-3.06-1.87-3.06-1.87 0-2.15 1.44-2.15 2.96V21h-4V9Z",
  },
  {
    label: "Instagram",
    href: "#",
    path: "M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.22.6 1.77 1.15.55.55.9 1.11 1.15 1.77.25.64.42 1.37.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.64.25-1.37.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.22 1.15-1.77A4.9 4.9 0 0 1 5.45.53c.64-.25 1.37-.42 2.43-.47C8.94.01 9.28 0 12 0Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm5.2-8.4a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z",
  },
  {
    label: "X",
    href: "#",
    path: "M3 2h4.2l4.1 5.8L16 2h4l-6.6 8.6L21 22h-4.2l-4.5-6.3L6.6 22H2.5l7-9.2L3 2Z",
  },
  {
    label: "TikTok",
    href: "#",
    path: "M16.5 2h-3v13.2a2.8 2.8 0 1 1-2-2.68V9.4a5.8 5.8 0 1 0 5 5.75V8.9a7 7 0 0 0 4 1.26V7.15a4 4 0 0 1-4-4.15V2Z",
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink-2">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16 grid md:grid-cols-[1fr_auto] gap-12 md:gap-20">
        <div className="max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <Image
              src="/icon.png"
              alt=""
              width={225}
              height={196}
              className="h-12 w-auto brightness-0 invert"
            />
            <p className="font-bricolage font-extrabold text-xl sm:text-2xl leading-tight text-white">
              Islamic Finance
              <br />
              Youth Summit
            </p>
          </div>
          <p className="text-white text-base leading-relaxed">
            Islamic Finance Youth Summit is a gathering for founders,
            professionals, students and investors building the next generation
            of companies.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-10 sm:gap-16">
          <div>
            <p className="font-plex font-medium text-base lg:text-lg leading-[1.3] sm:leading-[48px] tracking-normal text-rust uppercase mb-2 sm:mb-0">
              Explore
            </p>
            <ul className="flex flex-col gap-4">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-plex font-medium text-base lg:text-lg leading-[1.3] sm:leading-[48px] tracking-normal text-rust uppercase mb-2 sm:mb-0">
              More
            </p>
            <ul className="flex flex-col gap-4">
              {MORE_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-plex font-medium text-base lg:text-lg leading-[1.3] sm:leading-[48px] tracking-normal text-rust uppercase mb-2 sm:mb-0">
              Contact
            </p>
            <a
              href="mailto:contact@ifysummit.com"
              className="block text-white hover:text-white transition-colors mb-5 break-all"
            >
              contact@ifysummit.com
            </a>
            <div className="flex items-center gap-2.5">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-9 h-9 rounded-md border border-coral/60 text-rust flex items-center justify-center hover:bg-coral hover:text-white hover:border-coral transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 sm:pb-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-rust text-lg">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-4 h-4"
          >
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M14.5 9.5a2.7 2.7 0 1 0 0 5" />
          </svg>
          {new Date().getFullYear()}. All rights reserved
        </p>
        <a
          href="https://www.nextif.org"
          className="font-plex font-medium text-lg leading-[1.3] sm:leading-[48px] tracking-normal text-white underline underline-offset-4 hover:text-paper/80 transition-colors"
        >
          Organized by NEXTIF
        </a>
      </div>
    </footer>
  );
}
