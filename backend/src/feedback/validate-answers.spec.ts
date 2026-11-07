import { BadRequestException } from '@nestjs/common';
import { validAnswers } from './testing-answers';
import { validateAnswers } from './validate-answers';

describe('validateAnswers', () => {
  it('accepts a complete answer set for every role', () => {
    for (const role of ['attendee', 'speaker', 'sponsor'] as const) {
      expect(() =>
        validateAnswers(role, validAnswers(role), undefined),
      ).not.toThrow();
    }
  });

  it('allows optional questions to be skipped but not required ones', () => {
    const answers = validAnswers('attendee');
    delete answers.one_sentence; // voluntary
    expect(() => validateAnswers('attendee', answers, undefined)).not.toThrow();
    delete answers.overall; // required
    expect(() => validateAnswers('attendee', answers, undefined)).toThrow(
      BadRequestException,
    );
  });

  it('accepts a free-text "other" state but rejects an empty one', () => {
    const ok = { ...validAnswers('attendee'), next_state: { other: 'Gombe' } };
    expect(
      validateAnswers('attendee', ok, undefined).answers.next_state,
    ).toEqual({ other: 'Gombe' });
    const empty = { ...validAnswers('attendee'), next_state: { other: ' ' } };
    expect(() => validateAnswers('attendee', empty, undefined)).toThrow();
  });

  it('requires every row of a rating grid', () => {
    const answers = validAnswers('speaker');
    answers.experience_ratings = { pre_event_communication: 5 };
    expect(() => validateAnswers('speaker', answers, undefined)).toThrow();
  });

  it('rejects out-of-range numbers and unknown options', () => {
    const attendee = validAnswers('attendee');
    for (const bad of [
      { overall: 6 },
      { overall: 0 },
      { overall: 3.5 },
      { recommend: 11 },
      { personal_value: -1 },
      { familiarity: 'nope' },
      { sessions_attended: ['nope'] },
      { sessions_attended: [] },
    ]) {
      expect(() =>
        validateAnswers('attendee', { ...attendee, ...bad }, undefined),
      ).toThrow(BadRequestException);
    }
  });

  it('accepts the 0 end of the 0–5 and 0–10 scales', () => {
    const answers = {
      ...validAnswers('attendee'),
      personal_value: 0,
      recommend: 0,
    };
    expect(() => validateAnswers('attendee', answers, undefined)).not.toThrow();
  });

  it('drops answers that do not belong to the role', () => {
    const answers = { ...validAnswers('sponsor'), junk: 'x', familiarity: 'x' };
    const result = validateAnswers('sponsor', answers, undefined);
    expect(result.answers).not.toHaveProperty('junk');
    expect(result.answers).not.toHaveProperty('familiarity');
  });

  it('reads testimonial consent only for attendees', () => {
    expect(
      validateAnswers('attendee', validAnswers('attendee'), 'yes')
        .testimonialConsent,
    ).toBe(true);
    expect(
      validateAnswers('attendee', validAnswers('attendee'), 'no')
        .testimonialConsent,
    ).toBe(false);
    expect(
      validateAnswers('attendee', validAnswers('attendee'), undefined)
        .testimonialConsent,
    ).toBeNull();
    expect(
      validateAnswers('speaker', validAnswers('speaker'), 'yes')
        .testimonialConsent,
    ).toBeNull();
    expect(() =>
      validateAnswers('attendee', validAnswers('attendee'), 'maybe'),
    ).toThrow();
  });

  it('trims text and rejects non-text', () => {
    const answers = { ...validAnswers('attendee'), takeaway: '  hello  ' };
    expect(
      validateAnswers('attendee', answers, undefined).answers.takeaway,
    ).toBe('hello');
    expect(() =>
      validateAnswers('attendee', { ...answers, takeaway: 5 }, undefined),
    ).toThrow();
  });
});
