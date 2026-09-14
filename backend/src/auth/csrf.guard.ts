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
