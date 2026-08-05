"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ApiError,
  createSponsorApplication,
  requestSponsorApplicationUploadUrl,
  SponsorType,
  uploadSponsorApplicationLogo,
} from "@/lib/api";
import { SiteHeader } from "../site-header";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  showError,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  showError?: boolean;
  placeholder?: string;
}) {
  const invalid = showError && required && !value.trim();
  return (
    <label className="flex flex-col gap-1">
      <span className="text-base font-medium text-emerald/75">
        {label}
        {!required && <span className="text-muted font-normal"> (optional)</span>}
      </span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-cloud border rounded-sm px-3 py-3 text-base text-emerald placeholder:text-muted/60 focus:outline-none focus:border-gold ${
          invalid ? "border-red-500" : "border-line"
        }`}
      />
      {invalid && <span className="text-sm text-red-600">Required</span>}
    </label>
  );
}

export default function PartnerWithUsPage() {
  const [type, setType] = useState<SponsorType>("sponsor");
  const [organizationName, setOrganizationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [logoKey, setLogoKey] = useState<string | undefined>(undefined);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    setLogoError(null);
    try {
      const { key, uploadUrl } = await requestSponsorApplicationUploadUrl(
        file.name,
        file.type,
      );
      await uploadSponsorApplicationLogo(uploadUrl, file);
      setLogoKey(key);
      setLogoFileName(file.name);
    } catch {
      setLogoError("Upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
    }
  }

  const canSubmit =
    organizationName.trim() && contactName.trim() && email.trim();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setAttemptedSubmit(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createSponsorApplication({
        eventSlug: EVENT_SLUG,
        type,
        organizationName,
        contactName,
        email,
        phone: phone || undefined,
        message: message || undefined,
        logoKey,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.body.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col">
        <SiteHeader />
        <main className="bg-islamic-pattern text-emerald flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="w-full max-w-lg">
            <p className="font-mono text-sm sm:text-base font-semibold tracking-widest text-gold-deep uppercase mb-3">
              Thank you
            </p>
            <h1 className="font-display text-4xl sm:text-5xl italic text-emerald mb-6">
              Your application has been received.
            </h1>
            <p className="text-base text-muted mb-8">
              Our team will review your submission and reach out at {email} with next steps.
            </p>
            <Link
              href="/"
              className="inline-block bg-gold text-ink font-semibold text-lg px-6 py-2 rounded-sm"
            >
              Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <SiteHeader />
      <main className="bg-islamic-pattern text-emerald flex-1 flex flex-col items-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-2xl">
          <Link
            href="/"
            className="inline-flex items-center gap-1 border border-line rounded-sm px-3 py-1.5 text-sm text-emerald hover:bg-cloud mb-6"
          >
            ← Back to home
          </Link>
          <p className="font-mono text-sm sm:text-base font-semibold tracking-widest text-gold-deep uppercase mb-3">
            Islamic Finance Youth Summit 2026
          </p>
          <h1 className="font-display text-5xl sm:text-6xl italic text-emerald mb-10">
            Become a sponsor, partner or exhibitor.
          </h1>

          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-base font-medium text-emerald/75">I&apos;m applying as a</span>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-base text-emerald">
                <input
                  type="radio"
                  name="type"
                  checked={type === "sponsor"}
                  onChange={() => setType("sponsor")}
                />
                Sponsor
              </label>
              <label className="flex items-center gap-2 text-base text-emerald">
                <input
                  type="radio"
                  name="type"
                  checked={type === "partner"}
                  onChange={() => setType("partner")}
                />
                Partner
              </label>
            </div>
          </label>

          <TextField
            label="Organization name"
            value={organizationName}
            onChange={setOrganizationName}
            showError={attemptedSubmit}
            placeholder="e.g. Acme Bank"
          />
          <TextField
            label="Contact name"
            value={contactName}
            onChange={setContactName}
            showError={attemptedSubmit}
            placeholder="e.g. Yusuf Abdullahi"
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            showError={attemptedSubmit}
            placeholder="you@example.com"
          />
          <TextField
            label="Phone"
            type="tel"
            required={false}
            value={phone}
            onChange={setPhone}
            placeholder="080X XXX XXXX"
          />

          <label className="flex flex-col gap-1">
            <span className="text-base font-medium text-emerald/75">
              Message <span className="text-muted font-normal">(optional)</span>
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Tell us a bit about your organization and what you're hoping for."
              className="bg-cloud border border-line rounded-sm px-3 py-3 text-base text-emerald placeholder:text-muted/60 focus:outline-none focus:border-gold"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-base font-medium text-emerald/75">
              Logo <span className="text-muted font-normal">(optional)</span>
            </span>
            <div className="border border-dashed border-line rounded-sm px-4 py-4 flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleLogoUpload(file);
                  }}
                  className="text-base text-emerald file:mr-3 file:rounded-sm file:border file:border-line file:bg-cloud file:px-3 file:py-1.5 file:text-emerald"
                />
                {logoUploading && <span className="text-sm text-muted block mt-1">Uploading…</span>}
                {logoFileName && !logoUploading && (
                  <span className="text-sm text-gold-deep block mt-1">Uploaded: {logoFileName}</span>
                )}
                {logoError && <span className="text-sm text-red-600 block mt-1">{logoError}</span>}
              </div>
            </div>
          </label>

          {submitError && (
            <p className="text-base text-red-600 border border-red-200 bg-red-50 rounded-sm px-3 py-2">
              {submitError}
            </p>
          )}

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={submitting || logoUploading}
              className="bg-gold text-ink font-semibold text-lg px-6 py-2 rounded-sm disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </div>
          </form>
        </div>
      </main>
    </div>
  );
}
