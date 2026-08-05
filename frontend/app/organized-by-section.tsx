import Image from "next/image";
import Link from "next/link";

export function OrganizedBySection() {
  return (
    <section className="bg-islamic-pattern">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <h2 className="font-bricolage font-semibold text-2xl sm:text-3xl tracking-wide text-black mb-10 sm:mb-12">
          Organized By
        </h2>

        <Image
          src="/nextif.png"
          alt="NextIF — Nurturing the next leaders of Islamic Finance"
          width={257}
          height={92}
          className="h-16 sm:h-20 w-auto mx-auto mb-12 sm:mb-14"
        />

        <Link
          href="/partner-with-us"
          className="inline-block bg-coral text-white font-semibold text-sm sm:text-base px-8 py-2 rounded-full hover:bg-coral-deep transition-colors"
        >
          Become a Sponsor, Partner or Exhibitor
        </Link>
      </div>
    </section>
  );
}
