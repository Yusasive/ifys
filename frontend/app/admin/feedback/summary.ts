import type { FeedbackSubmissionRow } from "@/lib/admin-api";
import type { FeedbackAnswer, FeedbackOption, FeedbackQuestion } from "@/lib/feedback-form";

export interface ScoreSummary {
  count: number;
  average: number | null;
  // How many gave each score, from the lowest to the highest.
  distribution: { score: number; count: number }[];
}

function score(values: number[], min: number, max: number): ScoreSummary {
  const distribution = Array.from({ length: max - min + 1 }, (_, i) => ({
    score: min + i,
    count: values.filter((v) => v === min + i).length,
  }));
  return {
    count: values.length,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    distribution,
  };
}

export type QuestionSummary =
  | { kind: "score"; summary: ScoreSummary; nps: number | null }
  | { kind: "options"; count: number; options: { label: string; count: number }[] }
  | { kind: "grid"; rows: { label: string; summary: ScoreSummary }[] }
  | { kind: "text"; responses: { text: string; who: string | null; at: string }[] };

function isOther(a: FeedbackAnswer | undefined): a is { other: string } {
  return typeof a === "object" && a !== null && !Array.isArray(a) && "other" in a;
}

export function summarise(question: FeedbackQuestion, rows: FeedbackSubmissionRow[]): QuestionSummary {
  const answered = rows.filter((r) => r.answers[question.id] !== undefined);

  switch (question.type) {
    case "stars":
    case "scale": {
      const min = question.type === "stars" ? 1 : question.min;
      const max = question.type === "stars" ? 5 : question.max;
      const values = answered.map((r) => r.answers[question.id] as number);
      // Net Promoter Score is only meaningful on the 0–10 "would you recommend" scale.
      const nps =
        question.type === "scale" && min === 0 && max === 10 && values.length
          ? Math.round(
              ((values.filter((v) => v >= 9).length - values.filter((v) => v <= 6).length) / values.length) * 100,
            )
          : null;
      return { kind: "score", summary: score(values, min, max), nps };
    }
    case "single":
    case "multi": {
      const counts = new Map<string, number>(question.options.map((o) => [o.label, 0]));
      let other = 0;
      for (const r of answered) {
        const a = r.answers[question.id];
        const picked = Array.isArray(a) ? a : [a];
        for (const p of picked) {
          if (isOther(p as FeedbackAnswer)) {
            other += 1;
            continue;
          }
          const label = question.options.find((o: FeedbackOption) => o.value === p)?.label;
          if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
        }
      }
      const options = [...counts].map(([label, count]) => ({ label, count }));
      if (other) options.push({ label: "Other", count: other });
      return { kind: "options", count: answered.length, options };
    }
    case "grid":
      return {
        kind: "grid",
        rows: question.rows.map((row) => ({
          label: row.label,
          summary: score(
            answered.map((r) => (r.answers[question.id] as Record<string, number>)[row.value]).filter((v) => typeof v === "number"),
            1,
            5,
          ),
        })),
      };
    case "text":
      return {
        kind: "text",
        responses: answered.map((r) => ({
          text: r.answers[question.id] as string,
          who: r.name,
          at: r.createdAt,
        })),
      };
  }
}

// A readable version of one answer, for the CSV.
function plain(question: FeedbackQuestion, answer: FeedbackAnswer | undefined): string[] {
  if (question.type === "grid") {
    const ratings = (answer ?? {}) as Record<string, number>;
    return question.rows.map((row) => (ratings[row.value] === undefined ? "" : String(ratings[row.value])));
  }
  if (answer === undefined) return [""];
  if (question.type === "single") {
    if (isOther(answer)) return [`Other: ${answer.other}`];
    return [question.options.find((o) => o.value === answer)?.label ?? String(answer)];
  }
  if (question.type === "multi") {
    return [(answer as string[]).map((v) => question.options.find((o) => o.value === v)?.label ?? v).join("; ")];
  }
  return [String(answer)];
}

export function toCsv(
  questions: FeedbackQuestion[],
  rows: FeedbackSubmissionRow[],
  consentLabel: string,
  includeConsent: boolean,
): string {
  const header = [
    "Submitted",
    "Role",
    "Name",
    "Email",
    ...questions.flatMap((q) =>
      q.type === "grid" ? q.rows.map((row) => `${q.text} — ${row.label}`) : [q.text],
    ),
    ...(includeConsent ? [consentLabel] : []),
  ];
  const lines = rows.map((r) => [
    r.createdAt,
    r.role,
    r.name ?? "",
    r.email ?? "",
    ...questions.flatMap((q) => plain(q, r.answers[q.id])),
    ...(includeConsent ? [r.testimonialConsent === null ? "" : r.testimonialConsent ? "Yes" : "No"] : []),
  ]);
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  // The BOM keeps Excel from garbling non-English characters.
  return `﻿${[header, ...lines].map((l) => l.map(cell).join(",")).join("\r\n")}\r\n`;
}
