import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { SESSION_COOKIE } from './jwt-auth.guard';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Double-submit-cookie CSRF check: the cookie is set non-httpOnly so the
// frontend's JS can read it and echo it back as a header on mutating
// requests. A cross-site form/script can trigger the cookie to be sent
// automatically, but cannot read it to populate the header, so the two
// values only match for same-origin JS.
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
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const cookies = request.cookies as Record<string, string> | undefined;
    if (!cookies?.[SESSION_COOKIE]) return true;

    const cookieValue = cookies[CSRF_COOKIE];
    const headerValue = request.headers[CSRF_HEADER];

    if (
      !cookieValue ||
      typeof headerValue !== 'string' ||
      !safeCompare(cookieValue, headerValue)
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
