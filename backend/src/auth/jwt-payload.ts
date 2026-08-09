import { AdminRole } from '../generated/prisma/enums';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: AdminRole;
  // Unique per-token id, denylisted in Redis on logout.
  jti: string;
  // AdminUser.tokenVersion at issue-time — bumping the DB column
  // force-invalidates every token issued before the bump.
  tv: number;
  // Per-session CSRF token, minted at login and handed back in the login/me
  // response body. The frontend echoes it as the X-CSRF-Token header on
  // mutating requests; CsrfGuard compares it against this signed claim
  // instead of a second cookie, so it works even when the API and the
  // frontend are served from different origins.
  csrf: string;
  // Snapshot of AdminUser.mustChangePassword at issue-time — lets guards/
  // the frontend gate on it without a DB round trip. Refreshed into a new
  // token by POST /auth/change-password once cleared.
  mustChangePassword: boolean;
  // Added by jsonwebtoken on sign/verify, not set by us directly.
  iat?: number;
  exp?: number;
}
