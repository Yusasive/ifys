import { BadRequestException } from '@nestjs/common';
import {
  FEEDBACK_FORM,
  FeedbackQuestion,
  FeedbackRole,
  questionsFor,
} from './feedback-form';

export type FeedbackAnswers = Record<string, unknown>;

const MAX_TEXT_LENGTH = 3000;
const MAX_OTHER_LENGTH = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

function clean(question: FeedbackQuestion, value: unknown): unknown {
  const fail = (why: string): never => {
    throw new BadRequestException(`"${question.text}" — ${why}`);
  };

  switch (question.type) {
    case 'stars':
      if (
        !Number.isInteger(value) ||
        (value as number) < 1 ||
        (value as number) > 5
      ) {
        fail('choose 1 to 5 stars');
      }
      return value;

    case 'scale': {
      const n = value as number;
      if (!Number.isInteger(n) || n < question.min || n > question.max) {
        fail(`choose a number from ${question.min} to ${question.max}`);
      }
      return n;
    }

    case 'single': {
      // "Other" is sent as { other: "free text" }.
      if (isRecord(value) && question.allowOther) {
        const text = typeof value.other === 'string' ? value.other.trim() : '';
        if (!text) fail('please specify your answer');
        return { other: text.slice(0, MAX_OTHER_LENGTH) };
      }
      if (
        typeof value !== 'string' ||
        !question.options.some((o) => o.value === value)
      ) {
        fail('choose one of the options');
      }
      return value;
    }

    case 'multi': {
      if (!Array.isArray(value)) return fail('choose at least one option');
      const valid = new Set(question.options.map((o) => o.value));
      const unique = [...new Set(value)];
      if (unique.some((v) => typeof v !== 'string' || !valid.has(v))) {
        fail('choose from the listed options');
      }
      return unique;
    }

    case 'grid': {
      if (!isRecord(value)) return fail('rate every row');
      const result: Record<string, number> = {};
      for (const row of question.rows) {
        const rating = value[row.value];
        if (
          !Number.isInteger(rating) ||
          (rating as number) < 1 ||
          (rating as number) > 5
        ) {
          fail(`rate "${row.label}"`);
        }
        result[row.value] = rating as number;
      }
      return result;
    }

    case 'text': {
      if (typeof value !== 'string') return fail('must be text');
      const text = value.trim();
      if (text.length > MAX_TEXT_LENGTH) {
        fail(`keep it under ${MAX_TEXT_LENGTH} characters`);
      }
      return text;
    }
  }
}

// Checks a submission against the form for the chosen role and returns only
// the known, cleaned answers (unknown keys are dropped, not stored).
export function validateAnswers(
  role: FeedbackRole,
  raw: unknown,
  consent: unknown,
): { answers: FeedbackAnswers; testimonialConsent: boolean | null } {
  if (!isRecord(raw)) {
    throw new BadRequestException('answers must be an object');
  }

  const answers: FeedbackAnswers = {};
  for (const question of questionsFor(role)) {
    const value = raw[question.id];
    if (isBlank(value)) {
      if (question.required) {
        throw new BadRequestException(`Please answer: "${question.text}"`);
      }
      continue;
    }
    answers[question.id] = clean(question, value);
  }

  let testimonialConsent: boolean | null = null;
  // Only the attendee form asks for consent.
  if (role === 'attendee' && !isBlank(consent)) {
    const valid = FEEDBACK_FORM.consent.options.map((o) => o.value);
    if (typeof consent !== 'string' || !valid.includes(consent)) {
      throw new BadRequestException('Invalid testimonial consent answer');
    }
    testimonialConsent = consent === 'yes';
  }

  return { answers, testimonialConsent };
}
