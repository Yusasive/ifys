"use client";

import { FormEvent, ReactElement, useState } from "react";
import Link from "next/link";
import {
  ApiError,
  createSponsorApplication,
  requestSponsorApplicationUploadUrl,
  SponsorType,
  uploadSponsorApplicationLogo,
} from "@/lib/api";
import { FormBackButton } from "../form-back-button";
import { SiteHeader } from "../site-header";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

const TYPE_OPTIONS: { value: SponsorType; label: string }[] = [
  { value: "sponsor", label: "Sponsor" },
  { value: "partner", label: "Partner" },
  { value: "exhibitor", label: "Exhibitor" },
];

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="w-5 h-5 shrink-0"
    >
      <circle cx="12" cy="8" r="3.4" />
      <path strokeLinecap="round" d="M5 20c0-3.6 3.1-6.3 7-6.3s7 2.7 7 6.3" />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="w-5 h-5 shrink-0"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5v10.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V6.75Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m3.75 6.75 8.25 6.75 8.25-6.75"
      />
    </svg>
  );
}

function InstitutionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="w-5 h-5 shrink-0"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21h18M4 21V10m16 11V10M3 10l9-6 9 6M6 10v7m4-7v7m4-7v7m4-7v7"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="w-5 h-5 shrink-0"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path
        strokeLinecap="round"
        d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.2 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.2-3.4-8.5S9.8 5.8 12 3.5Z"
      />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="w-5 h-5 shrink-0"
    >
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}

function BudgetIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="w-5 h-5 shrink-0"
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path strokeLinecap="round" d="M3 10h18" />
      <path strokeLinecap="round" d="M6.5 14h3" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="w-5 h-5 shrink-0"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5.5h16v10a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V17a1.5 1.5 0 0 1-1.5-1.5v-10Z"
      />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="w-6 h-6 shrink-0"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 18a4 4 0 0 1-.5-7.97A5 5 0 0 1 16.2 8.02 4 4 0 0 1 17 16h-1"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 12v7m0-7 2.5 2.5M12 12l-2.5 2.5"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path d="M21.44 2.56a.75.75 0 0 0-.8-.17L2.9 9.24a.75.75 0 0 0 .04 1.4l7.06 2.53 2.53 7.06a.75.75 0 0 0 1.4.04l6.85-17.74a.75.75 0 0 0-.34-.97ZM11.2 12.7 4.86 10.4l13.4-5.17-7.06 7.47Zm2.09 6.94-2.3-6.34 7.47-7.06-5.17 13.4Z" />
    </svg>
  );
}

function PillField({
  icon,
  value,
  onChange,
  type = "text",
  required = true,
  showError,
  placeholder,
}: {
  icon: ReactElement;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  showError?: boolean;
  placeholder: string;
}) {
  const invalid = showError && required && !value.trim();
  return (
    <label className="flex flex-col gap-1">
      <div
        className={`flex items-center gap-2 sm:gap-3 rounded-full border bg-white px-4 sm:px-5 py-3 sm:py-4 text-rust focus-within:border-rust ${
          invalid ? "border-red-500" : "border-rust/70"
        }`}
      >
        {icon}
        <input
          required={required}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-sm sm:text-lg text-emerald placeholder:text-emerald/70 focus:outline-none"
        />
      </div>
      {invalid && <span className="text-sm text-red-600 pl-5">Required</span>}
    </label>
  );
}

export function SponsorForm() {
  const [type, setType] = useState<SponsorType>("sponsor");
  const [organizationName, setOrganizationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [budgetNote, setBudgetNote] = useState("");
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
        websiteUrl: websiteUrl || undefined,
        budgetNote: budgetNote || undefined,
        message: message || undefined,
        logoKey,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.body.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <>
        <SiteHeader />
        <main className="relative bg-white text-emerald flex-1 flex flex-col items-center px-4 pt-14 pb-10 sm:pb-14">
          <FormBackButton />
          <div className="w-full max-w-2xl text-center">
            <h1 className="font-plex text-lg sm:text-2xl font-medium leading-tight sm:leading-[48px] tracking-normal uppercase text-forest mb-4 sm:mb-6">
              Collaboration Successful
            </h1>
            <p className="font-bricolage text-lg sm:text-2xl font-medium leading-tight sm:leading-[48px] tracking-normal text-black mb-6 sm:mb-8">
              Thank you for your interest in joining us to shape the future of
              Islamic finance
            </p>

            <div className="w-full lg:w-[541px] mx-auto bg-rust rounded-[10px] px-6 py-10 sm:px-10 lg:py-12">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-6 rounded-full border-2 border-white text-white flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-8 h-8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12.5 10 16l8-8"
                  />
                </svg>
              </div>
              <p className="font-sans text-base sm:text-2xl font-medium leading-snug sm:leading-[48px] tracking-normal text-center text-white max-w-sm mx-auto">
                A member of our team will reach out to you shortly regarding
                your preferred category of participation. We look forward to
                collaborating with you.
              </p>
            </div>

            <Link
              href="/"
              className="inline-block mt-8 bg-rust text-white font-semibold text-base px-8 py-3 rounded-full hover:bg-rust/90 transition-colors"
            >
              Back to home
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="relative bg-white text-emerald flex-1 flex flex-col items-center px-4 pt-14 pb-10 sm:pb-14">
        <FormBackButton />

        <div className="w-full max-w-3xl">
          <p className="text-base sm:text-lg font-semibold text-black text-center max-w-2xl mx-auto mb-10">
            Join us in shaping the future of Islamic finance. Position your
            brand before a vibrant community of young people, professionals,
            entrepreneurs, and industry leaders who are driving ethical finance
            forward. Secure your place today and be part of an event designed to
            create lasting impact.
          </p>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            className="flex flex-col gap-4"
          >
            <PillField
              icon={<PersonIcon />}
              value={contactName}
              onChange={setContactName}
              showError={attemptedSubmit}
              placeholder="Full Name"
            />
            <PillField
              icon={<EnvelopeIcon />}
              type="email"
              value={email}
              onChange={setEmail}
              showError={attemptedSubmit}
              placeholder="Work Email"
            />
            <PillField
              icon={<InstitutionIcon />}
              value={organizationName}
              onChange={setOrganizationName}
              showError={attemptedSubmit}
              placeholder="Organization/Company"
            />
            <PillField
              icon={<GlobeIcon />}
              type="url"
              required={false}
              value={websiteUrl}
              onChange={setWebsiteUrl}
              placeholder="Website"
            />

            <label className="flex items-center gap-2 sm:gap-3 rounded-full border border-rust/70 bg-white px-4 sm:px-5 py-3 sm:py-4 text-rust focus-within:border-rust">
              <GridIcon />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SponsorType)}
                className="flex-1 min-w-0 bg-transparent text-sm sm:text-lg text-emerald focus:outline-none"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <PillField
              icon={<BudgetIcon />}
              required={false}
              value={budgetNote}
              onChange={setBudgetNote}
              placeholder="Sponsorship/Partnership Interest/Budget (Where Applicable)"
            />
            <PillField
              icon={<MessageIcon />}
              required={false}
              value={message}
              onChange={setMessage}
              placeholder="Additional Message"
            />

            <label className="flex flex-col gap-1 mt-2">
              <div
                className={`relative flex items-center justify-center gap-2 sm:gap-3 rounded-full border bg-white px-4 sm:px-6 py-3 sm:py-4 text-rust ${
                  logoError ? "border-red-500" : "border-rust/70"
                }`}
              >
                <CloudUploadIcon />
                <span className="text-sm sm:text-lg text-emerald text-center truncate min-w-0">
                  {logoFileName ?? "Organization Logo (Optional)"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleLogoUpload(file);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              {logoUploading && (
                <span className="text-sm text-muted pl-5">Uploading…</span>
              )}
              {logoError && (
                <span className="text-sm text-red-600 pl-5">{logoError}</span>
              )}
            </label>

            {submitError && (
              <p className="text-base text-red-600 border border-red-200 bg-red-50 rounded-sm px-3 py-2">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || logoUploading}
              className="flex items-center justify-center gap-2 sm:gap-3 mx-auto w-full max-w-sm bg-rust text-white font-semibold text-base sm:text-xl rounded-full py-4 sm:py-5 mt-4 hover:bg-rust/90 transition-colors disabled:opacity-40"
            >
              <SendIcon />
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
