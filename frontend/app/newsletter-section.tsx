"use client";

import { FormEvent, useState } from "react";
import { ApiError, subscribeToNewsletter } from "@/lib/api";

function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 shrink-0 text-black/65">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5v10.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6.75Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 6.75 8.25 6.75 8.25-6.75" />
    </svg>
  );
}

function PaperPlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
      <path d="M21.44 2.56a.75.75 0 0 0-.8-.17L2.9 9.24a.75.75 0 0 0 .04 1.4l7.06 2.53 2.53 7.06a.75.75 0 0 0 1.4.04l6.85-17.74a.75.75 0 0 0-.34-.97ZM11.2 12.7 4.86 10.4l13.4-5.17-7.06 7.47Zm2.09 6.94-2.3-6.34 7.47-7.06-5.17 13.4Z" />
    </svg>
  );
}

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await subscribeToNewsletter(email);
      setSubmitted(true);
      setEmail("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.body.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="bg-white">
        <div className="mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center max-w-2xl">
          <h2 className="font-plex text-lg sm:text-2xl font-medium leading-tight sm:leading-[48px] tracking-normal uppercase text-forest mb-4 sm:mb-6">
            Subscription Successful
          </h2>
          <p className="font-bricolage text-lg sm:text-2xl font-medium leading-tight sm:leading-[48px] tracking-normal text-black mb-6 sm:mb-8">
            You Will Receive Newsletter From Us
          </p>

          <div className="w-full lg:w-[541px] mx-auto bg-rust rounded-[10px] px-6 py-10 sm:px-10 lg:py-12">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-6 rounded-full border-2 border-white text-white flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12.5 10 16l8-8" />
              </svg>
            </div>
            <p className="font-sans text-base sm:text-2xl font-medium leading-snug sm:leading-[48px] tracking-normal text-center text-white max-w-sm mx-auto">
              We look forward giving you the best experience you deserve. Check your Email for
              your confirmation message.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white">
      <div className=" mx-auto px-4 lg:px-6 py-16 sm:py-24 text-center">
        <h2 className="font-plex text-lg text-2xl font-normal tracking-normal text-rust text-center mb-4">
          Sign up for more Updates
        </h2>
        <p className="font-bricolage  lg:px-20  font-normal text-md lg:text-2xl tracking-normal text-center text-black/80 mb-10">
          No spam, just good vibes! We promise not to flood your inbox with unwanted messages and
          we shall keep your data safe
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex lg:mx-24 items-center justify-center gap-3 rounded-full border border-coral bg-white px-5 lg:py-2">
            <EnvelopeIcon />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="bg-transparent font-sans font-normal text-lg leading-[48px] tracking-normal text-left text-black/65 placeholder:text-black/65 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex lg:mx-24  items-center justify-center gap-2 rounded-full bg-rust text-white font-semibold text-base py-3.5 lg:py-6 hover:bg-coral-deep transition-colors disabled:opacity-50"
          >
            <PaperPlaneIcon />
            {submitting ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
      </div>
    </section>
  );
}
