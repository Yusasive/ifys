import { createHmac, timingSafeEqual } from 'node:crypto';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function signUnsubscribe(email: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`unsubscribe:${normalizeEmail(email)}`)
    .digest('base64url');
}

export function isValidUnsubscribe(
  email: string,
  token: string,
  secret: string,
): boolean {
  const expected = Buffer.from(signUnsubscribe(email, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface UnsubscribeLinks {
  // The page a person lands on from the footer link (asks them to confirm).
  pageUrl: string;
  // The List-Unsubscribe target that Gmail/Yahoo POST to (RFC 8058).
  oneClickUrl: string;
}

// Both live on the frontend (HTTPS, unlike the bare ALB URL); the one-click
// route there forwards to POST /email/unsubscribe.
export function unsubscribeLinks(
  email: string,
  frontendOrigin: string,
  secret: string,
): UnsubscribeLinks {
  const query = new URLSearchParams({
    e: normalizeEmail(email),
    t: signUnsubscribe(email, secret),
  }).toString();
  return {
    pageUrl: `${frontendOrigin}/unsubscribe?${query}`,
    oneClickUrl: `${frontendOrigin}/unsubscribe/one-click?${query}`,
  };
}
