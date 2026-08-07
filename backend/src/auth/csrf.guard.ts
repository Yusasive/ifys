import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { SESSION_COOKIE } from './jwt-auth.guard';

export const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Synchronizer-token CSRF check: a per-session token is minted at login,
// signed into the JWT itself (see JwtPayload.csrf), and handed back once in
// the login/me response body. The frontend keeps it in memory and echoes it
// as a header on mutating requests. A cross-site form/script can make the
// browser attach the session cookie automatically, but it can't read the
// login response body (blocked by CORS/same-origin policy) or set custom
// headers, so it can never produce a matching header value.
//
// This intentionally doesn't rely on a second, JS-readable cookie (the
// classic double-submit pattern) — that approach breaks whenever the API
// and the frontend are served from different origins, since a cookie set by
// one origin isn't visible to `document.cookie` on another.
//
// CSRF is only a risk when the browser is the one silently attaching
// credentials (i.e. the session cookie). A caller authenticating via an
// explicit `Authorization: Bearer` header (a script, a mobile client, our
// own integration tests) isn't susceptible — nothing attaches that header
// automatically — so we only enforce the check when the request actually
// carries the session cookie.
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (SAFE_METHODS.has(request.method)) return true;

    const cookies = request.cookies as Record<string, string> | undefined;
    if (!cookies?.[SESSION_COOKIE]) return true;

    const expected = request.user?.csrf;
    const headerValue = request.headers[CSRF_HEADER];

    if (
      !expected ||
      typeof headerValue !== 'string' ||
      !safeCompare(expected, headerValue)
    ) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }
    return true;
  }
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
