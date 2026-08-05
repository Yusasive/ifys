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
  // Added by jsonwebtoken on sign/verify, not set by us directly.
  iat?: number;
  exp?: number;
}
