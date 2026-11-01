import * as Sentry from "@sentry/browser";

let initialised = false;

// No-op unless NEXT_PUBLIC_SENTRY_DSN is set, so local dev never reports.
function init(): boolean {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return false;
  if (!initialised) {
    Sentry.init({ dsn, environment: process.env.NODE_ENV, tracesSampleRate: 0 });
    initialised = true;
  }
  return true;
}

export function reportClientError(error: unknown) {
  if (init()) Sentry.captureException(error);
}
