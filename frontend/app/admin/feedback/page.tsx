"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchFeedback, FeedbackSubmissionRow } from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { describeError } from "@/lib/api";
import type { FeedbackForm, FeedbackQuestion, FeedbackRole } from "@/lib/feedback-form";
import { useToast } from "@/lib/toast-context";
import { QuestionSummary, ScoreSummary, summarise, toCsv } from "./summary";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-1/2 sm:w-2/5 text-ink">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-emerald/10 overflow-hidden">
        <div className="h-full bg-forest rounded-full" style={{ width: max ? `${(count / max) * 100}%` : 0 }} />
      </div>
      <span className="w-8 text-right tabular-nums text-sage">{count}</span>
    </div>
  );
}

function Distribution({ summary }: { summary: ScoreSummary }) {
  const max = Math.max(...summary.distribution.map((d) => d.count), 1);
  return (
    <div className="flex flex-col gap-1">
      {summary.distribution.map((d) => (
        <Bar key={d.score} label={String(d.score)} count={d.count} max={max} />
      ))}
    </div>
  );
}

function average(summary: ScoreSummary) {
  return summary.average === null ? "–" : summary.average.toFixed(1);
}

function SummaryView({ question, summary }: { question: FeedbackQuestion; summary: QuestionSummary }) {
  if (summary.kind === "score") {
    const top = question.type === "stars" ? 5 : question.type === "scale" ? question.max : 5;
    return (
      <div>
        <p className="text-sm text-ink mb-2">
          <span className="text-2xl font-bold text-forest">{average(summary.summary)}</span>
          <span className="text-sage"> / {top} average · {summary.summary.count} response{summary.summary.count === 1 ? "" : "s"}</span>
          {summary.nps !== null && (
            <span className="ml-3 text-sage">
              NPS <span className="font-semibold text-ink">{summary.nps}</span>
            </span>
          )}
        </p>
        <Distribution summary={summary.summary} />
      </div>
    );
  }
  if (summary.kind === "options") {
    const max = Math.max(...summary.options.map((o) => o.count), 1);
    return (
      <div className="flex flex-col gap-1">
        {summary.options.map((o) => (
          <Bar key={o.label} label={o.label} count={o.count} max={max} />
        ))}
      </div>
    );
  }
  if (summary.kind === "grid") {
    return (
      <div className="flex flex-col gap-2">
        {summary.rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 text-sm">
            <span className="w-1/2 sm:w-2/5 text-ink">{row.label}</span>
            <div className="flex-1 h-2.5 rounded-full bg-emerald/10 overflow-hidden">
              <div
                className="h-full bg-forest rounded-full"
                style={{ width: row.summary.average ? `${(row.summary.average / 5) * 100}%` : 0 }}
              />
            </div>
            <span className="w-16 text-right tabular-nums text-ink font-semibold">{average(row.summary)} / 5</span>
          </div>
        ))}
      </div>
    );
  }
  if (summary.responses.length === 0) return <p className="text-sm text-sage">No responses.</p>;
  return (
    <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
      {summary.responses.map((r, i) => (
        <li key={i} className="text-sm text-ink bg-emerald/5 rounded-xl px-3 py-2 whitespace-pre-wrap">
          {r.text}
          <span className="block text-xs text-sage mt-1">
            {r.who ?? "Anonymous"} · {new Date(r.at).toLocaleDateString("en-NG")}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminFeedbackPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const toast = useToast();
  const [form, setForm] = useState<FeedbackForm | null>(null);
  const [rows, setRows] = useState<FeedbackSubmissionRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [role, setRole] = useState<FeedbackRole>("attendee");

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchFeedback(EVENT_SLUG)
      .then((data) => {
        if (cancelled) return;
        setForm(data.form);
        setRows(data.submissions);
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) toast.error(describeError(err, "Failed to load feedback."));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, reloadKey]);

  const roleRows = useMemo(() => rows.filter((r) => r.role === role), [rows, role]);
  const sections = form?.sections[role] ?? [];
  const questions = sections.flatMap((s) => s.questions);
  const summaries = useMemo(
    () => new Map(questions.map((q) => [q.id, summarise(q, roleRows)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, role, roleRows],
  );
  const consentYes = roleRows.filter((r) => r.testimonialConsent).length;

  function exportCsv() {
    if (!form || roleRows.length === 0) return;
    const csv = toCsv(questions, roleRows, form.consent.text, role === "attendee");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback-${role}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (authLoading || !session) return null;

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest">Feedback</h1>
          <p className="text-sm text-sage mt-1 max-w-3xl">
            Responses to the Stakeholder Feedback Form at <span className="font-mono">/feedback</span>. It is anonymous
            unless the person chose to add a name or email.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={exportCsv}
            disabled={roleRows.length === 0}
            className="bg-forest text-white font-semibold px-5 py-1.5 rounded-full text-sm hover:bg-emerald transition-colors disabled:opacity-40"
          >
            Export {role} responses (CSV)
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6" role="tablist">
        {(form?.roles ?? [{ value: "attendee", label: "Attendees" }, { value: "speaker", label: "Speakers" }, { value: "sponsor", label: "Sponsors" }]).map(
          (option) => {
            const count = rows.filter((r) => r.role === option.value).length;
            const active = role === option.value;
            return (
              <button
                key={option.value}
                role="tab"
                aria-selected={active}
                onClick={() => setRole(option.value as FeedbackRole)}
                className={`rounded-full px-5 py-2 text-sm font-semibold border transition-colors ${
                  active ? "bg-forest border-forest text-white" : "border-emerald/20 text-ink hover:bg-emerald/5"
                }`}
              >
                {option.label} ({count})
              </button>
            );
          },
        )}
      </div>

      {!loaded && <p className="text-sm text-sage">Loading…</p>}

      {loaded && roleRows.length === 0 && (
        <p className="text-sm text-sage border border-dashed border-emerald/20 rounded-2xl p-8 text-center bg-white">
          No {role} feedback yet.
        </p>
      )}

      {loaded && roleRows.length > 0 && (
        <div className="flex flex-col gap-8">
          {role === "attendee" && (
            <p className="text-sm text-sage">
              {consentYes} of {roleRows.length} agreed to let you use their feedback or testimonial in reports and
              promotional material.
            </p>
          )}
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-bricolage font-bold text-lg text-forest mb-3">{section.title}</h2>
              <div className="flex flex-col gap-4">
                {section.questions.map((question) => {
                  const summary = summaries.get(question.id);
                  return (
                    <div key={question.id} className="border border-emerald/20 rounded-2xl bg-white p-4">
                      <p className="text-sm font-semibold text-ink mb-3">
                        {questions.indexOf(question) + 1}. {question.text}
                      </p>
                      {summary && <SummaryView question={question} summary={summary} />}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
