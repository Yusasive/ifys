"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createFeedback, describeError, fetchFeedbackForm } from "@/lib/api";
import type {
  FeedbackAnswer,
  FeedbackAnswers,
  FeedbackForm,
  FeedbackQuestion,
  FeedbackRole,
} from "@/lib/feedback-form";
import { FormBackButton } from "../form-back-button";
import { SiteHeader } from "../site-header";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";
const DRAFT_KEY = "ify-feedback-draft-v1";

interface Draft {
  role: FeedbackRole | null;
  answersByRole: Partial<Record<FeedbackRole, FeedbackAnswers>>;
  consent: string;
  name: string;
  email: string;
}

// Browser storage can be missing or blocked (private mode); the form must
// work without it.
function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function isAnswered(question: FeedbackQuestion, answer: FeedbackAnswer | undefined): boolean {
  if (answer === undefined || answer === null) return false;
  switch (question.type) {
    case "stars":
    case "scale":
      return typeof answer === "number";
    case "single":
      if (typeof answer === "object") return "other" in answer && !!(answer as { other: string }).other.trim();
      return typeof answer === "string" && answer !== "";
    case "multi":
      return Array.isArray(answer) && answer.length > 0;
    case "grid": {
      const rows = answer as Record<string, number>;
      return question.rows.every((row) => typeof rows[row.value] === "number");
    }
    case "text":
      return typeof answer === "string" && answer.trim() !== "";
  }
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-9 h-9" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
      <path strokeLinejoin="round" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.9 6.6 19.9l1-6.1L3.2 9.5l6.1-.9L12 3Z" />
    </svg>
  );
}

const pill = (active: boolean) =>
  `rounded-full border px-4 py-2 text-sm sm:text-base transition-colors ${
    active
      ? "bg-rust border-rust text-white"
      : "bg-white border-rust/70 text-emerald hover:bg-rust/10"
  }`;

function QuestionField({
  question,
  number,
  gridColumns,
  value,
  onChange,
  showError,
}: {
  question: FeedbackQuestion;
  number: number;
  gridColumns: FeedbackForm["gridColumns"];
  value: FeedbackAnswer | undefined;
  onChange: (value: FeedbackAnswer | undefined) => void;
  showError: boolean;
}) {
  const invalid = showError && question.required && !isAnswered(question, value);
  const name = `q-${question.id}`;

  let control: React.ReactNode = null;
  switch (question.type) {
    case "stars": {
      const n = typeof value === "number" ? value : 0;
      control = (
        <div className="flex gap-1 text-rust" role="radiogroup" aria-label={question.text}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={n === star}
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
              onClick={() => onChange(star)}
              className="hover:scale-110 transition-transform"
            >
              <StarIcon filled={star <= n} />
            </button>
          ))}
        </div>
      );
      break;
    }
    case "scale": {
      const numbers = Array.from({ length: question.max - question.min + 1 }, (_, i) => question.min + i);
      control = (
        <div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={question.text}>
            {numbers.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={value === n}
                onClick={() => onChange(n)}
                className={`${pill(value === n)} w-11 text-center px-0`}
              >
                {n}
              </button>
            ))}
          </div>
          {(question.minLabel || question.maxLabel) && (
            <div className="flex justify-between text-sm text-muted mt-1.5 max-w-xl">
              <span>{question.minLabel}</span>
              <span>{question.maxLabel}</span>
            </div>
          )}
        </div>
      );
      break;
    }
    case "single": {
      const isOther = typeof value === "object" && value !== null && !Array.isArray(value) && "other" in value;
      control = (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={question.text}>
          {question.options.map((option) => (
            <label key={option.value} className="flex items-start gap-3 cursor-pointer text-base text-emerald">
              <input
                type="radio"
                name={name}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="mt-1.5 accent-rust"
              />
              <span>{option.label}</span>
            </label>
          ))}
          {question.allowOther && (
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-3 cursor-pointer text-base text-emerald">
                <input
                  type="radio"
                  name={name}
                  checked={isOther}
                  onChange={() => onChange({ other: "" })}
                  className="mt-1.5 accent-rust"
                />
                <span>Others (please specify)</span>
              </label>
              {isOther && (
                <input
                  value={(value as { other: string }).other}
                  onChange={(e) => onChange({ other: e.target.value })}
                  maxLength={120}
                  placeholder="Which state?"
                  aria-label="Other, please specify"
                  className="ml-7 max-w-sm rounded-full border border-rust/70 bg-white px-4 py-2 text-base text-emerald placeholder:text-emerald/50 focus:outline-none focus:border-rust"
                />
              )}
            </div>
          )}
        </div>
      );
      break;
    }
    case "multi": {
      const selected = Array.isArray(value) ? value : [];
      control = (
        <div className="flex flex-col gap-2">
          {question.options.map((option) => (
            <label key={option.value} className="flex items-start gap-3 cursor-pointer text-base text-emerald">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() =>
                  onChange(
                    selected.includes(option.value)
                      ? selected.filter((v) => v !== option.value)
                      : [...selected, option.value],
                  )
                }
                className="mt-1.5 accent-rust"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );
      break;
    }
    case "grid": {
      const ratings = (typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}) as Record<string, number>;
      control = (
        <div className="flex flex-col gap-5">
          {question.rows.map((row) => (
            <div key={row.value}>
              <p className="text-base font-medium text-emerald mb-2">{row.label}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={row.label}>
                {gridColumns.map((column) => {
                  const rating = Number(column.value);
                  return (
                    <button
                      key={column.value}
                      type="button"
                      role="radio"
                      aria-checked={ratings[row.value] === rating}
                      onClick={() => onChange({ ...ratings, [row.value]: rating })}
                      className={pill(ratings[row.value] === rating)}
                    >
                      {column.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
      break;
    }
    case "text":
      control = (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          maxLength={3000}
          aria-label={question.text}
          className={`w-full bg-white border rounded-2xl px-4 sm:px-5 py-3 text-base text-emerald placeholder:text-emerald/50 focus:outline-none focus:border-rust ${
            invalid ? "border-red-500" : "border-rust/70"
          }`}
        />
      );
      break;
  }

  return (
    <fieldset data-question={question.id} data-invalid={invalid || undefined} className="flex flex-col gap-2.5">
      <legend className="text-base sm:text-lg font-medium text-emerald mb-1">
        <span className="text-rust">{number}.</span> {question.text}
        {!question.required && <span className="text-muted font-normal"> (optional)</span>}
      </legend>
      {question.hint && <p className="text-sm text-muted -mt-1">{question.hint}</p>}
      {control}
      {invalid && <span className="text-sm text-red-600">Please answer this question.</span>}
    </fieldset>
  );
}

export function FeedbackFormPage() {
  const [form, setForm] = useState<FeedbackForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft] = useState(() => (typeof window === "undefined" ? null : readDraft()));
  const [role, setRole] = useState<FeedbackRole | null>(draft?.role ?? null);
  // Kept per role, so switching role by mistake doesn't lose anything.
  const [answersByRole, setAnswersByRole] = useState<Partial<Record<FeedbackRole, FeedbackAnswers>>>(draft?.answersByRole ?? {});
  const [consent, setConsent] = useState(draft?.consent ?? "");
  const [name, setName] = useState(draft?.name ?? "");
  const [email, setEmail] = useState(draft?.email ?? "");
  const [website, setWebsite] = useState(""); // honeypot, never shown
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFeedbackForm()
      .then((data) => !cancelled && setForm(data))
      .catch((err) => !cancelled && setLoadError(describeError(err, "Could not load the feedback form.")));
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep saving the unfinished form as it changes.
  useEffect(() => {
    if (submitted) return;
    const empty = !role && !consent && !name && !email && Object.keys(answersByRole).length === 0;
    writeDraft(empty ? null : { role, answersByRole, consent, name, email });
  }, [submitted, role, answersByRole, consent, name, email]);

  const sections = form && role ? form.sections[role] : [];
  const required = sections.flatMap((s) => s.questions).filter((q) => q.required);
  const answeredCount = required.filter((q) => isAnswered(q, (role && answersByRole[role]?.[q.id]) || undefined)).length;
  const needsName = role === "attendee" && consent === "yes" && !name.trim();
  const answers = (role && answersByRole[role]) || {};

  function setAnswer(id: string, value: FeedbackAnswer | undefined) {
    if (!role) return;
    setAnswersByRole((prev) => {
      const next = { ...(prev[role] ?? {}) };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return { ...prev, [role]: next };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!role || !form || submitting) return;
    const missing = sections.flatMap((s) => s.questions).find((q) => q.required && !isAnswered(q, answers[q.id]));
    if (!missing && needsName) {
      setAttempted(true);
      formRef.current?.querySelector("[data-name-field]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (missing) {
      setAttempted(true);
      formRef.current?.querySelector(`[data-question="${missing.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createFeedback({
        eventSlug: EVENT_SLUG,
        role,
        answers,
        consent: role === "attendee" && consent ? consent : undefined,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        website: website || undefined,
      });
      writeDraft(null);
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setSubmitError(describeError(err, "Something went wrong. Please try again."));
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
            <p className="font-mono text-sm sm:text-base font-semibold tracking-widest text-rust uppercase mb-3">Thank you</p>
            <h1 className="font-display text-4xl sm:text-5xl italic text-emerald mb-6">We&apos;ve received your feedback.</h1>
            <p className="text-base text-muted mb-8">
              Jazakumullahu khayran. Your honest feedback will help us make future editions of IFY Summit even better.
            </p>
            <Link href="/" className="inline-block bg-rust text-white font-semibold text-base px-8 py-3 rounded-full hover:bg-rust/90 transition-colors">
              Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  let questionNumber = 0;

  return (
    <div className="flex-1 flex flex-col">
      <SiteHeader showJoinTeam={false} />
      <main className="relative bg-white text-emerald flex-1 flex flex-col items-center px-4 pt-14 pb-10">
        <FormBackButton />
        <div className="w-full max-w-2xl">
          <p className="font-mono text-sm sm:text-base font-semibold tracking-widest text-rust uppercase mb-3">
            Islamic Finance Youth Summit 2026
          </p>
          <h1 className="font-display text-5xl sm:text-6xl italic text-emerald mb-4">Stakeholder Feedback Form</h1>

          {loadError && <p className="text-red-600 text-base">{loadError}</p>}
          {!form && !loadError && <p className="text-muted text-base">Loading…</p>}

          {form && (
            <>
              <div className="flex flex-col gap-4 text-base text-muted mb-10">
                <p className="italic text-emerald">{form.intro.greeting}</p>
                {form.intro.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} noValidate className="flex flex-col gap-8">
                <fieldset className="flex flex-col gap-3">
                  <legend className="text-base sm:text-lg font-medium text-emerald mb-1">
                    <span className="text-rust">1.</span> What was your role at IFY Summit 1.0?
                  </legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Your role">
                    {form.roles.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={role === option.value}
                        onClick={() => setRole(option.value as FeedbackRole)}
                        className={`${pill(role === option.value)} px-6`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {attempted && !role && <span className="text-sm text-red-600">Please choose your role.</span>}
                </fieldset>

                {role && (
                  <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-white/95 backdrop-blur border-b border-rust/20">
                    <div className="flex justify-between text-sm text-muted mb-1">
                      <span>
                        {answeredCount} of {required.length} required questions answered
                      </span>
                      <span>Your progress is saved on this device</span>
                    </div>
                    <div className="h-2 rounded-full bg-rust/15 overflow-hidden">
                      <div
                        className="h-full bg-rust transition-all"
                        style={{ width: required.length ? `${(answeredCount / required.length) * 100}%` : 0 }}
                      />
                    </div>
                  </div>
                )}

                {role &&
                  sections.map((section) => (
                    <section key={section.title} className="flex flex-col gap-8">
                      <div className="border-b border-rust/30 pb-2">
                        <h2 className="font-plex text-lg sm:text-xl font-medium uppercase text-forest">{section.title}</h2>
                        {section.description && <p className="text-base text-muted mt-1">{section.description}</p>}
                      </div>
                      {section.questions.map((question) => {
                        questionNumber += 1;
                        return (
                          <QuestionField
                            key={question.id}
                            question={question}
                            number={questionNumber + 1}
                            gridColumns={form.gridColumns}
                            value={answers[question.id]}
                            onChange={(value) => setAnswer(question.id, value)}
                            showError={attempted}
                          />
                        );
                      })}
                    </section>
                  ))}

                {role && (
                  <section className="flex flex-col gap-6">
                    <div className="border-b border-rust/30 pb-2">
                      <h2 className="font-plex text-lg sm:text-xl font-medium uppercase text-forest">Before you go</h2>
                    </div>

                    {role === "attendee" && (
                      <fieldset className="flex flex-col gap-2.5">
                        <legend className="text-base sm:text-lg font-medium text-emerald mb-1">
                          {form.consent.text} <span className="text-muted font-normal">(optional)</span>
                        </legend>
                        <div className="flex gap-2">
                          {form.consent.options.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              role="radio"
                              aria-checked={consent === option.value}
                              onClick={() => setConsent(consent === option.value ? "" : option.value)}
                              className={`${pill(consent === option.value)} px-6`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    )}

                    <div className="flex flex-col gap-3">
                      <p className="text-base text-muted">
                        Your feedback is anonymous unless you choose to add your details. Both fields are optional.
                      </p>
                      <input
                        data-name-field
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={120}
                        placeholder={needsName || (role === "attendee" && consent === "yes") ? "Your name (required)" : "Your name (optional)"}
                        aria-label="Your name"
                        className={`rounded-full border bg-white px-5 py-3 text-base text-emerald placeholder:text-emerald/50 focus:outline-none focus:border-rust ${
                          attempted && needsName ? "border-red-500" : "border-rust/70"
                        }`}
                      />
                      {attempted && needsName && (
                        <span className="text-sm text-red-600 -mt-1">
                          Please add your name so we can credit your testimonial, or choose No.
                        </span>
                      )}
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Your email (optional)"
                        aria-label="Your email (optional)"
                        className="rounded-full border border-rust/70 bg-white px-5 py-3 text-base text-emerald placeholder:text-emerald/50 focus:outline-none focus:border-rust"
                      />
                    </div>
                  </section>
                )}

                <input
                  type="text"
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                />

                {submitError && <p className="text-red-600 text-base text-center">{submitError}</p>}
                {attempted && role && answeredCount < required.length && (
                  <p className="text-red-600 text-base text-center">Some required questions are unanswered.</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  onClick={() => !role && setAttempted(true)}
                  className="mx-auto w-full max-w-sm bg-rust text-white font-semibold text-base sm:text-xl rounded-full py-4 sm:py-5 hover:bg-rust/90 transition-colors disabled:opacity-40"
                >
                  {submitting ? "Submitting…" : "Submit feedback"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
