import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, getSpeaker } from "@/lib/api";
import { SiteHeader } from "../../site-header";
import { SiteFooter } from "../../site-footer";
import { FormBackButton } from "../../form-back-button";

// Speaker photo URLs are short-lived signed S3/R2 links, so this page must
// be rendered per-request rather than statically.
export const dynamic = "force-dynamic";

export default async function SpeakerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const speaker = await getSpeaker(slug).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });

  if (!speaker) notFound();

  return (
    <div className="flex-1 flex flex-col">
      <SiteHeader />
      <main className="relative flex-1 bg-islamic-pattern px-4 sm:px-6 pt-14 pb-16">
        <FormBackButton />
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center text-center">
            <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-ink/85 flex items-center justify-center overflow-hidden relative border border-line/60">
              {speaker.photoUrl ? (
                <Image
                  src={speaker.photoUrl}
                  alt={speaker.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span className="font-bricolage font-bold text-6xl text-white/90">
                  ?
                </span>
              )}
            </div>

            <div className="mt-6 bg-coral rounded-xl px-5 py-3">
              <p className="font-bricolage font-bold text-sm sm:text-base uppercase tracking-wide text-white">
                {speaker.tag}
              </p>
            </div>

            <h1 className="mt-6 font-bricolage font-bold text-2xl sm:text-3xl text-black">
              {speaker.name}
            </h1>
            <p className="mt-1 text-base text-muted">{speaker.role}</p>
          </div>

          <div className="mt-10 bg-white rounded-2xl border border-line/60 p-6 sm:p-10">
            {speaker.bio ? (
              // whitespace-pre-wrap keeps the bio exactly as the admin typed
              // it (line breaks and spacing included) instead of collapsing
              // it, so the admin-side textarea is a true WYSIWYG preview of
              // this page.
              <p className="whitespace-pre-wrap font-plex text-base sm:text-lg leading-relaxed text-ink">
                {speaker.bio}
              </p>
            ) : (
              <p className="text-sage italic">
                No bio has been added for this speaker yet.
              </p>
            )}
          </div>

          <div className="mt-8 flex justify-center">
            <Link
              href="/#speakers"
              className="inline-flex items-center gap-2 bg-coral text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-coral-deep transition-colors"
            >
              ← Back to all speakers
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
