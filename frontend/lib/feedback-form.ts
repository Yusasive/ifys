// Shapes of the feedback form served by GET /feedback/form
// (backend/src/feedback/feedback-form.ts is the source of truth).

export type FeedbackRole = "attendee" | "speaker" | "sponsor";

export interface FeedbackOption {
  value: string;
  label: string;
}

export type FeedbackQuestion = {
  id: string;
  text: string;
  hint?: string;
  required: boolean;
} & (
  | { type: "stars" }
  | { type: "scale"; min: number; max: number; minLabel?: string; maxLabel?: string }
  | { type: "single"; options: FeedbackOption[]; allowOther?: boolean }
  | { type: "multi"; options: FeedbackOption[] }
  | { type: "grid"; rows: FeedbackOption[] }
  | { type: "text" }
);

export interface FeedbackSection {
  title: string;
  description?: string;
  questions: FeedbackQuestion[];
}

export interface FeedbackForm {
  intro: { greeting: string; body: string[] };
  roles: FeedbackOption[];
  gridColumns: FeedbackOption[];
  sections: Record<FeedbackRole, FeedbackSection[]>;
  consent: { id: string; text: string; options: FeedbackOption[] };
}

// One answer, as submitted: a number (stars/scale), an option value or
// { other } (single), option values (multi), { rowValue: 1-5 } (grid) or text.
export type FeedbackAnswer =
  | number
  | string
  | string[]
  | { other: string }
  | Record<string, number>;

export type FeedbackAnswers = Record<string, FeedbackAnswer>;
