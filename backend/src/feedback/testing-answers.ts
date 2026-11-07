import { questionsFor } from './feedback-form';

// A complete, valid answer for every required question of a role.
export function validAnswers(role: 'attendee' | 'speaker' | 'sponsor') {
  const answers: Record<string, unknown> = {};
  for (const q of questionsFor(role)) {
    switch (q.type) {
      case 'stars':
        answers[q.id] = 5;
        break;
      case 'scale':
        answers[q.id] = q.max;
        break;
      case 'single':
        answers[q.id] = q.options[0].value;
        break;
      case 'multi':
        answers[q.id] = [q.options[0].value];
        break;
      case 'grid':
        answers[q.id] = Object.fromEntries(q.rows.map((r) => [r.value, 4]));
        break;
      case 'text':
        answers[q.id] = 'Great summit';
        break;
    }
  }
  return answers;
}
