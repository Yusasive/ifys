import { JobsOptions } from 'bullmq';

// SMTP providers (Zoho in production) reject or throttle sends from time to
// time. Without retries a single rejected send meant the email was lost for
// good, so every job retries with backoff (1, 2, 4, 8, 16 min) and failed
// jobs are kept in Redis so they can be inspected.
export const EMAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 6,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};
