import Link from "next/link";
import { Metadata } from "next";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export const metadata: Metadata = {
  title: "Page Not Found",
};

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col">
      <SiteHeader />
      <main className="flex-1 bg-islamic-pattern flex items-center justify-center px-4 py-20 text-center">
        <div className="max-w-md">
          <p className="font-bricolage font-bold text-7xl sm:text-8xl text-coral">
            404
          </p>
          <h1 className="mt-4 font-bricolage font-bold text-2xl sm:text-3xl text-black">
            Page not found
          </h1>
          <p className="mt-3 text-base text-muted">
            The page you&apos;re looking for doesn&apos;t exist or may have
            been moved.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 bg-coral text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-coral-deep transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
