"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ApiError,
  createVolunteerApplication,
  VOLUNTEER_AREAS,
  VOLUNTEER_SKILLS,
  VOLUNTEER_TEAMS,
  VolunteerTeam,
} from "@/lib/api";
import { SiteHeader } from "../site-header";
import { FormBackButton } from "../form-back-button";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path d="M21.44 2.56a.75.75 0 0 0-.8-.17L2.9 9.24a.75.75 0 0 0 .04 1.4l7.06 2.53 2.53 7.06a.75.75 0 0 0 1.4.04l6.85-17.74a.75.75 0 0 0-.34-.97ZM11.2 12.7 4.86 10.4l13.4-5.17-7.06 7.47Zm2.09 6.94-2.3-6.34 7.47-7.06-5.17 13.4Z" />
    </svg>
  );
}

const OCCUPATIONAL_STATUSES = [
  { value: "student", label: "Student" },
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "unemployed", label: "Unemployed" },
  { value: "other", label: "Other" },
] as const;

const YES_NO_MAYBE = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "maybe", label: "Maybe, depending on the location" },
] as const;

const COMMIT_OPTIONS = [
  { value: "yes", label: "Yes, I can commit time before and during the event" },
  { value: "no", label: "No, I can't commit" },
  { value: "maybe", label: "Maybe, I'm not sure yet" },
] as const;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-rust mt-2 mb-1">
      {children}
    </h2>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = true,
  placeholder,
  showError,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  showError?: boolean;
}) {
  const invalid = showError && required && !value.trim();
  return (
    <label className="flex flex-col gap-1">
      <span className="text-base font-medium text-emerald/75">
        {label}
        {!required && <span className="text-muted font-normal"> (optional)</span>}
      </span>
      <div
        className={`flex items-center rounded-full border bg-white px-4 sm:px-5 py-3 sm:py-4 focus-within:border-rust ${
          invalid ? "border-red-500" : "border-rust/70"
        }`}
      >
        <input
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-sm sm:text-lg text-emerald placeholder:text-emerald/50 focus:outline-none"
        />
      </div>
      {invalid && <span className="text-sm text-red-600">Required</span>}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  required = true,
  placeholder,
  showError,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  showError?: boolean;
}) {
  const invalid = showError && required && !value.trim();
  return (
    <label className="flex flex-col gap-1">
      <span className="text-base font-medium text-emerald/75">
        {label}
        {!required && <span className="text-muted font-normal"> (optional)</span>}
      </span>
      <textarea
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={`bg-white border rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-lg text-emerald placeholder:text-emerald/50 focus:outline-none focus:border-rust ${
          invalid ? "border-red-500" : "border-rust/70"
        }`}
      />
      {invalid && <span className="text-sm text-red-600">Required</span>}
    </label>
  );
}

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | "";
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-medium text-emerald/75">{label}</span>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-base text-emerald">
            <input
              type="radio"
              required
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-rust"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function CheckboxGroup({
  label,
  options,
  values,
  onChange,
  required = true,
}: {
  label: string;
  options: readonly string[];
  values: string[];
  onChange: (values: string[]) => void;
  required?: boolean;
}) {
  function toggle(option: string) {
    onChange(
      values.includes(option) ? values.filter((v) => v !== option) : [...values, option],
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-medium text-emerald/75">
        {label}
        {!required && <span className="text-muted font-normal"> (optional)</span>}
      </span>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-base text-emerald">
            <input
              type="checkbox"
              checked={values.includes(opt)}
              onChange={() => toggle(opt)}
              className="accent-rust"
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  fullName: "",
  phone: "",
  email: "",
  location: "",
  willingToTravel: "" as "" | "yes" | "no" | "maybe",
  occupationalStatus: "" as "" | (typeof OCCUPATIONAL_STATUSES)[number]["value"],
  occupationalStatusOther: "",
  aboutYourself: "",
  volunteeredBefore: "" as "" | "yes" | "no",
  volunteeredAreas: [] as string[],
  skills: [] as string[],
  skillsOther: "",
  team: "" as "" | VolunteerTeam,
  whyVolunteer: "",
  availabilityCommitment: "" as "" | "yes" | "no" | "maybe",
  timeCommitment: "",
  additionalComments: "",
};

export function VolunteerForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSubmit =
    form.fullName.trim() &&
    form.phone.trim() &&
    form.email.trim() &&
    form.location.trim() &&
    form.willingToTravel &&
    form.occupationalStatus &&
    form.aboutYourself.trim() &&
    form.volunteeredBefore &&
    form.skills.length > 0 &&
    form.team &&
    form.whyVolunteer.trim() &&
    form.availabilityCommitment &&
    form.timeCommitment.trim();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setAttemptedSubmit(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createVolunteerApplication({
        eventSlug: EVENT_SLUG,
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        location: form.location,
        willingToTravel: form.willingToTravel as "yes" | "no" | "maybe",
        occupationalStatus: form.occupationalStatus as
          | "student"
          | "employed"
          | "self_employed"
          | "entrepreneur"
          | "unemployed"
          | "other",
        occupationalStatusOther: form.occupationalStatusOther || undefined,
        aboutYourself: form.aboutYourself,
        volunteeredBefore: form.volunteeredBefore === "yes",
        volunteeredAreas: form.volunteeredAreas.length ? form.volunteeredAreas : undefined,
        skills: form.skills,
        skillsOther: form.skillsOther || undefined,
        team: form.team as VolunteerTeam,
        whyVolunteer: form.whyVolunteer,
        availabilityCommitment: form.availabilityCommitment as "yes" | "no" | "maybe",
        timeCommitment: form.timeCommitment,
        additionalComments: form.additionalComments || undefined,
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
        <SiteHeader showJoinTeam={false} />
        <main className="relative bg-white text-emerald flex-1 flex flex-col items-center justify-center px-4 pt-14 pb-10 text-center">
          <FormBackButton />
          <div className="w-full max-w-lg">
            <p className="font-mono text-sm sm:text-base font-semibold tracking-widest text-rust uppercase mb-3">
              Thank you
            </p>
            <h1 className="font-display text-4xl sm:text-5xl italic text-emerald mb-6">
              Your volunteer application has been received.
            </h1>
            <p className="text-base text-muted mb-8">
              Selected volunteers will be contacted at {form.email} with further details regarding
              their roles, orientation, and event-day responsibilities.
            </p>
            <Link
              href="/"
              className="inline-block bg-rust text-white font-semibold text-base px-8 py-3 rounded-full hover:bg-rust/90 transition-colors"
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
      <SiteHeader showJoinTeam={false} />
      <main className="relative bg-white text-emerald flex-1 flex flex-col items-center px-4 pt-14 pb-10">
        <FormBackButton />
        <div className="w-full max-w-2xl">
        <p className="font-mono text-sm sm:text-base font-semibold tracking-widest text-rust uppercase mb-3">
            Islamic Finance Youth Summit 2026
          </p>
          <h1 className="font-display text-5xl sm:text-6xl italic text-emerald mb-4">
            Volunteer Registration Form
          </h1>

          <div className="flex flex-col gap-4 text-base text-muted mb-10">
            <p>
              Are you passionate about Islamic finance, youth development, leadership, and
              community impact? Join us as a volunteer for the Islamic Finance Youth Summit and be
              part of a team working to create an engaging and impactful experience for young
              people interested in the future of Islamic finance.
            </p>

            <div>
              <p className="mb-1">Volunteering gives you the opportunity to:</p>
              <ol className="list-decimal list-inside flex flex-col gap-0.5">
                <li>Gain practical event experience</li>
                <li>Build valuable professional networks</li>
                <li>Develop new skills, and</li>
                <li>Contribute to the growth of the Islamic finance ecosystem among young people.</li>
              </ol>
            </div>

            <p>
              We are looking for enthusiastic, responsible, and committed individuals to support
              various aspects of the summit, whether you&apos;re great with people, love
              organizing or have creative and technical talents, we have a place for you.
            </p>

            <div>
              <p className="mb-1">Volunteer teams include:</p>
              <ol className="list-decimal list-inside flex flex-col gap-1">
                <li>
                  <span className="font-medium text-emerald">Programs Team</span> – Supports
                  planning and coordination of sessions, speakers, and overall flow of the summit
                  agenda.
                </li>
                <li>
                  <span className="font-medium text-emerald">Partnerships & Sponsorships Team</span> –
                  Assists in engaging sponsors, partners, and exhibitors, ensuring value delivery
                  and relationship management.
                </li>
                <li>
                  <span className="font-medium text-emerald">Marketing & Communications Team</span> –
                  Drives awareness and engagement through social media, content creation, media
                  relations, and promotions.
                </li>
                <li>
                  <span className="font-medium text-emerald">Operations & Logistics Team</span> –
                  Manages venue setup, registration, attendee experience, and smooth onsite
                  coordination.
                </li>
                <li>
                  <span className="font-medium text-emerald">Design & Branding Team</span> – Creates
                  visually appealing designs, summit materials, and ensures brand consistency
                  across all platforms.
                </li>
                <li>
                  <span className="font-medium text-emerald">Photography & Videography Team</span> –
                  Handles event highlights, photography, interviews, live streaming.
                </li>
                <li>
                  <span className="font-medium text-emerald">Welfare & Hospitality Team</span> –
                  Ensures volunteers, speakers, and guests are well taken care of, covering
                  catering, hospitality, and overall comfort.
                </li>
                <li>
                  <span className="font-medium text-emerald">Registration and Ticketing Team</span> –
                  Manages attendee check-in, registration, and admission before and during the
                  event.
                </li>
              </ol>
            </div>

            <p>
              If you are ready to contribute your time, skills, and energy, we would love to have
              you on the team. Please complete this form with accurate information. Selected
              volunteers will be contacted with further details regarding their roles,
              orientation, and event-day responsibilities.
            </p>

            <p className="italic text-emerald">
              Together, let&apos;s shape the future of Islamic finance.
            </p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex flex-col gap-4">
          <SectionHeading>Your details</SectionHeading>
          <TextField
            label="Full name"
            value={form.fullName}
            onChange={(v) => set("fullName", v)}
            showError={attemptedSubmit}
          />
          <TextField
            label="Phone number (WhatsApp preferably)"
            value={form.phone}
            onChange={(v) => set("phone", v)}
            showError={attemptedSubmit}
          />
          <TextField
            label="Email address"
            value={form.email}
            onChange={(v) => set("email", v)}
            showError={attemptedSubmit}
          />
          <TextField
            label="What is your current location? (City and State)"
            value={form.location}
            onChange={(v) => set("location", v)}
            showError={attemptedSubmit}
          />
          <RadioGroup
            label="Are you willing to travel to the event location (Ilorin) to support the IFY Summit if required?"
            options={YES_NO_MAYBE}
            value={form.willingToTravel}
            onChange={(v) => set("willingToTravel", v)}
          />

          <SectionHeading>About you</SectionHeading>
          <RadioGroup
            label="What is your current occupational status?"
            options={OCCUPATIONAL_STATUSES}
            value={form.occupationalStatus}
            onChange={(v) => set("occupationalStatus", v)}
          />
          {form.occupationalStatus === "other" && (
            <TextField
              label="Please specify"
              value={form.occupationalStatusOther}
              onChange={(v) => set("occupationalStatusOther", v)}
              required={false}
            />
          )}
          <TextAreaField
            label="Tell us a little more about yourself based on your selected status (e.g. institution, course of study, and level if a student; your profession or role if employed/self-employed)"
            value={form.aboutYourself}
            onChange={(v) => set("aboutYourself", v)}
            showError={attemptedSubmit}
          />

          <SectionHeading>Volunteering experience</SectionHeading>
          <RadioGroup
            label="Have you volunteered for an event before?"
            options={
              [
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ] as const
            }
            value={form.volunteeredBefore}
            onChange={(v) => set("volunteeredBefore", v)}
          />
          {form.volunteeredBefore === "yes" && (
            <CheckboxGroup
              label="If yes, which area have you volunteered before?"
              options={VOLUNTEER_AREAS}
              values={form.volunteeredAreas}
              onChange={(v) => set("volunteeredAreas", v)}
              required={false}
            />
          )}

          <SectionHeading>Your contribution</SectionHeading>
          <CheckboxGroup
            label="What skills can you contribute?"
            options={VOLUNTEER_SKILLS}
            values={form.skills}
            onChange={(v) => set("skills", v)}
          />
          <TextField
            label="Other skills"
            value={form.skillsOther}
            onChange={(v) => set("skillsOther", v)}
            required={false}
          />
          <RadioGroup
            label="What team would you like to join?"
            options={VOLUNTEER_TEAMS}
            value={form.team}
            onChange={(v) => set("team", v)}
          />
          <TextAreaField
            label="Why do you want to volunteer for the IFY Summit?"
            value={form.whyVolunteer}
            onChange={(v) => set("whyVolunteer", v)}
            showError={attemptedSubmit}
          />

          <SectionHeading>Availability</SectionHeading>
          <RadioGroup
            label="The IFY Summit is happening on November 5th, 2026. Are you available to dedicate consistent hours leading up to the event?"
            options={COMMIT_OPTIONS}
            value={form.availabilityCommitment}
            onChange={(v) => set("availabilityCommitment", v)}
          />
          <TextField
            label="Please tell us how much time you can realistically dedicate to volunteering (e.g. hours per week or specific days)"
            value={form.timeCommitment}
            onChange={(v) => set("timeCommitment", v)}
            showError={attemptedSubmit}
          />
          <TextAreaField
            label="Any additional comments or information you would like to share?"
            value={form.additionalComments}
            onChange={(v) => set("additionalComments", v)}
            required={false}
          />

          {submitError && (
            <p className="text-base text-red-600 border border-red-200 bg-red-50 rounded-sm px-3 py-2">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 sm:gap-3 mx-auto w-full max-w-sm bg-rust text-white font-semibold text-base sm:text-xl rounded-full py-4 sm:py-5 mt-4 hover:bg-rust/90 transition-colors disabled:opacity-40"
          >
            <SendIcon />
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        </form>
        </div>
      </main>
    </div>
  );
}
