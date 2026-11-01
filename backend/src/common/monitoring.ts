import * as Sentry from '@sentry/node';

let enabled = false;

// No-op unless SENTRY_DSN is set, so local dev and tests never report.
export function initMonitoring(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
  enabled = true;
}

export function reportException(
  exception: unknown,
  context: Record<string, string>,
): void {
  if (!enabled) return;
  Sentry.captureException(exception, { extra: context });
}
