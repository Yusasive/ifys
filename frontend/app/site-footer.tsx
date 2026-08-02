import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="bg-ink-2">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center gap-6 text-center">
        <Image src="/logo.png" alt="Islamic Finance Youth Summit" width={314} height={372} className="h-14 w-auto" />
        <p className="text-sm text-paper/60 max-w-md">
          Ilorin Innovation Hub, Multipurpose Hall &middot; Ilorin, Nigeria &middot; 7 November 2026
        </p>
        <a href="mailto:contact@ifysummit.com" className="text-sm text-gold-light hover:text-gold-deep transition-colors">
          contact@ifysummit.com
        </a>
        <p className="font-mono text-xs text-paper/40 uppercase tracking-widest">
          &copy; {new Date().getFullYear()} Islamic Finance Youth Summit &middot; Organized by NextIF
        </p>
      </div>
    </footer>
  );
}
