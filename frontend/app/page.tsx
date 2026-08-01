import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs tracking-widest text-gold-light uppercase mb-4">
        Ilorin Innovation Hub · 7 Nov 2026
      </p>
      <h1 className="font-display italic text-3xl sm:text-5xl max-w-2xl text-paper mb-8">
        The Ethical Generation: Rethinking Finance &amp; Innovation.
      </h1>
      <Link
        href="/register"
        className="bg-gold text-ink font-medium px-8 py-3 rounded-sm"
      >
        Register now
      </Link>
    </main>
  );
}
