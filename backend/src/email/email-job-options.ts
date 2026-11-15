import { JobsOptions } from 'bullmq';

export const EMAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 6,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};
