// The Stakeholder Feedback Form, as data. This is the single source of truth:
// GET /feedback/form serves it to the public page (which renders it), and
// submissions are validated against it, so the two can never drift.
// Source: "IFY Summit 2026 - Stakeholder Feedback Form.docx".

export const FEEDBACK_ROLES = ['attendee', 'speaker', 'sponsor'] as const;
export type FeedbackRole = (typeof FEEDBACK_ROLES)[number];

export type FeedbackOption = { value: string; label: string };

export type FeedbackQuestion = {
  id: string;
  text: string;
  hint?: string;
  required: boolean;
} & (
  | { type: 'stars' } // 1–5 stars
  | {
      type: 'scale';
      min: number;
      max: number;
      minLabel?: string;
      maxLabel?: string;
    }
  | { type: 'single'; options: FeedbackOption[]; allowOther?: boolean }
  | { type: 'multi'; options: FeedbackOption[] }
  | { type: 'grid'; rows: FeedbackOption[] } // each row rated 1–5 (Poor … Excellent)
  | { type: 'text' }
);

export type FeedbackSection = {
  title: string;
  description?: string;
  questions: FeedbackQuestion[];
};

export const GRID_COLUMNS: FeedbackOption[] = [
  { value: '1', label: 'Poor' },
  { value: '2', label: 'Fair' },
  { value: '3', label: 'Good' },
  { value: '4', label: 'Very Good' },
  { value: '5', label: 'Excellent' },
];

const opts = (...labels: string[]): FeedbackOption[] =>
  labels.map((label) => ({
    value: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''),
    label,
  }));

const SESSIONS = opts(
  'Opening Keynote: The Ethical Generation: Rethinking Finance & Innovation',
  'Panel Session 1: The Ethical Innovation Gap: Are We Building Enough?',
  'Panel Session 2: Money in Your Twenties and Thirties: Building Wealth the Halal Way',
  'Panel Session 3: Inside Islamic Finance: Ask Us Anything',
  'Panel Session 4: The Builder’s Legacy: Building for the Hereafter',
);

const STATES = opts(
  'Abuja (FCT)',
  'Oyo',
  'Ogun',
  'Osun',
  'Kwara',
  'Rivers',
  'Kaduna',
  'Lagos',
);

const YES_TO_SOME_NO = opts('Yes', 'To some extent', 'No');
const YES_MAYBE_NO = opts('Yes', 'Maybe', 'No');

const ATTENDEE: FeedbackSection[] = [
  {
    title: 'Your experience',
    questions: [
      {
        id: 'overall',
        text: 'Overall, how would you rate your experience at IFY Summit 1.0?',
        type: 'stars',
        required: true,
      },
      {
        id: 'personal_value',
        text: 'How valuable was the summit to you personally?',
        type: 'scale',
        min: 0,
        max: 5,
        minLabel: 'Not valuable',
        maxLabel: 'Extremely valuable',
        required: true,
      },
      {
        id: 'recommend',
        text: 'How likely are you to recommend IFY Summit to a friend or colleague?',
        type: 'scale',
        min: 0,
        max: 10,
        minLabel: 'Not likely',
        maxLabel: 'Very likely',
        required: true,
      },
      {
        id: 'familiarity',
        text: 'Before attending IFY Summit 1.0, how familiar were you with Islamic finance?',
        type: 'single',
        options: opts(
          'Very familiar',
          'Somewhat familiar',
          'Slightly familiar',
          'Not familiar at all',
        ),
        required: true,
      },
    ],
  },
  {
    title: 'The programme',
    questions: [
      {
        id: 'sessions_attended',
        text: 'Which of the following sessions or activities did you participate in?',
        hint: 'Select all that apply.',
        type: 'multi',
        options: SESSIONS,
        required: true,
      },
      {
        id: 'most_valuable_session',
        text: 'Which session or activity did you find most valuable?',
        type: 'single',
        options: SESSIONS,
        required: true,
      },
      {
        id: 'why_valuable',
        text: 'What made that session or activity particularly valuable to you?',
        type: 'text',
        required: true,
      },
      {
        id: 'programme_ratings',
        text: 'How would you rate the following aspects of the summit programme?',
        type: 'grid',
        rows: opts(
          'Relevance of topics discussed',
          'Quality of speakers and panellists',
          'Practical usefulness of discussions',
          'Diversity of perspectives shared',
        ),
        required: true,
      },
      {
        id: 'takeaway',
        text: 'What’s one important insight, lesson or idea you’re taking away from IFY Summit 1.0?',
        type: 'text',
        required: true,
      },
    ],
  },
  {
    title: 'The event and what comes next',
    questions: [
      {
        id: 'event_ratings',
        text: 'How would you rate the following aspects of the event?',
        type: 'grid',
        rows: opts(
          'Registration and check-in',
          'Communication before the event',
          'Venue and accessibility',
          'Seating and comfort',
          'Event timing and organisation',
          'Overall event atmosphere',
        ),
        required: true,
      },
      {
        id: 'brought_together',
        text: 'How well did IFY Summit bring together conversations around Islamic finance, ethical enterprise and innovation?',
        type: 'scale',
        min: 1,
        max: 5,
        minLabel: 'Not well',
        maxLabel: 'Very well',
        required: true,
      },
      {
        id: 'connections',
        text: 'Did you have opportunities to connect with other participants, speakers or industry professionals during the summit?',
        type: 'single',
        options: opts(
          'Yes, and I made meaningful connections.',
          'Yes, but I didn’t establish meaningful connections.',
          'I had limited opportunities to connect.',
          'No, I didn’t have such opportunities.',
        ),
        required: true,
      },
      {
        id: 'enjoyed_and_improve',
        text: 'What did you particularly enjoy about IFY Summit 1.0, and were there any challenges, inconveniences or areas you think we could improve?',
        hint: 'You may comment on both parts of the question.',
        type: 'text',
        required: false,
      },
      {
        id: 'next_state',
        text: 'Beyond Ilorin, which other Nigerian state would you like to see IFY Summit hosted in subsequent editions?',
        type: 'single',
        options: STATES,
        allowOther: true,
        required: false,
      },
      {
        id: 'one_sentence',
        text: 'In one sentence, how would you describe IFY Summit 1.0 to someone who wasn’t there?',
        type: 'text',
        required: false,
      },
    ],
  },
];

const SPEAKER: FeedbackSection[] = [
  {
    title: 'Speaker feedback',
    description: 'For speakers and session contributors.',
    questions: [
      {
        id: 'overall',
        text: 'How would you rate your overall experience as a speaker at IFY Summit 1.0?',
        type: 'stars',
        required: true,
      },
      {
        id: 'experience_ratings',
        text: 'How would you rate the following aspects of your experience?',
        type: 'grid',
        rows: opts(
          'Pre-event communication',
          'Clarity of expectations and speaker instructions',
          'Session organisation and coordination',
          'Time allocated for your session',
          'Technical and logistical support',
        ),
        required: true,
      },
      {
        id: 'audience_engagement',
        text: 'How would you rate the level of audience engagement and interaction during your session?',
        type: 'scale',
        min: 1,
        max: 5,
        minLabel: 'Very low',
        maxLabel: 'Very high',
        required: true,
      },
      {
        id: 'aligned',
        text: 'Did you feel your contribution aligned with the summit’s theme and objectives?',
        type: 'single',
        options: YES_TO_SOME_NO,
        required: true,
      },
      {
        id: 'worked_well',
        text: 'What worked particularly well during your participation?',
        type: 'text',
        required: false,
      },
      {
        id: 'improve',
        text: 'Were there any challenges or areas we could improve upon in our engagement with speakers?',
        type: 'text',
        required: false,
      },
      {
        id: 'return',
        text: 'Would you be interested in participating in subsequent editions of IFY Summit?',
        type: 'single',
        options: YES_MAYBE_NO,
        required: true,
      },
    ],
  },
];

const SPONSOR: FeedbackSection[] = [
  {
    title: 'Sponsor feedback',
    description:
      'Thank you for partnering with us for the inaugural edition of IFY Summit. We’d appreciate your feedback on your sponsorship experience and how we can make future partnerships more valuable.',
    questions: [
      {
        id: 'overall',
        text: 'How would you rate your overall experience as a sponsor of IFY Summit 1.0?',
        type: 'stars',
        required: true,
      },
      {
        id: 'experience_ratings',
        text: 'How would you rate the following aspects of your sponsorship experience?',
        type: 'grid',
        rows: opts(
          'Pre-event communication',
          'Clarity of sponsorship benefits',
          'Fulfilment of agreed sponsorship deliverables',
          'Brand visibility and recognition',
          'On-site coordination and support',
        ),
        required: true,
      },
      {
        id: 'value',
        text: 'To what extent did the summit provide value for your organisation?',
        type: 'single',
        options: opts(
          'Excellent value',
          'Good value',
          'Fair value',
          'Limited value',
          'No significant value',
        ),
        required: true,
      },
      {
        id: 'connections',
        text: 'Did the summit provide opportunities for your organisation to connect with relevant audiences, potential customers or industry stakeholders?',
        type: 'single',
        options: opts('Yes', 'To some extent', 'No', 'Not applicable'),
        required: true,
      },
      {
        id: 'most_valuable',
        text: 'What aspects of your sponsorship experience did you find most valuable?',
        type: 'text',
        required: false,
      },
      {
        id: 'unmet',
        text: 'Were there any expectations that were not met or areas where we could have done better?',
        type: 'text',
        required: false,
      },
      {
        id: 'future_benefits',
        text: 'What additional benefits or opportunities would you like to see offered to sponsors in subsequent editions?',
        type: 'text',
        required: false,
      },
      {
        id: 'again',
        text: 'Would your organisation consider sponsoring or partnering with future editions of IFY Summit?',
        type: 'single',
        options: YES_MAYBE_NO,
        required: true,
      },
    ],
  },
];

export const FEEDBACK_FORM = {
  intro: {
    greeting: 'As-salaam ‘alaykum wa rahmatullahi wa barakatuh.',
    body: [
      'Thank you for being part of the inaugural edition of the Islamic Finance Youth Summit (IFY Summit 1.0). Your presence, contributions and support played a valuable role in bringing this edition to life, and we truly appreciate it.',
      'As we reflect on this first edition and look ahead to future summits, we’d love to hear about your experience. What stood out to you? What could we have done better? And what would you like to see in subsequent editions?',
      'Your honest feedback will help us understand what worked, identify areas for improvement and make future editions even better.',
    ],
  },
  roles: [
    { value: 'attendee', label: 'Attendee' },
    { value: 'speaker', label: 'Speaker' },
    { value: 'sponsor', label: 'Sponsor' },
  ] as FeedbackOption[],
  gridColumns: GRID_COLUMNS,
  sections: {
    attendee: ATTENDEE,
    speaker: SPEAKER,
    sponsor: SPONSOR,
  } as Record<FeedbackRole, FeedbackSection[]>,
  consent: {
    id: 'testimonial_consent',
    text: 'Can we use your feedback or testimonial in future IFY Summit reports, publications, or promotional communications?',
    options: opts('Yes', 'No'),
  },
};

export function questionsFor(role: FeedbackRole): FeedbackQuestion[] {
  return FEEDBACK_FORM.sections[role].flatMap((section) => section.questions);
}
