import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { JwtPayload } from './jwt-payload';
import { getEffectivePermissions, PermissionKey } from './permissions';

export const SESSION_COOKIE = 'admin_session';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload & { permissions: PermissionKey[] };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing session');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (await this.auth.isDenylisted(payload.jti)) {
      throw new UnauthorizedException('Session has been revoked');
    }

    const user = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true, role: true, permissions: true },
    });
    if (!user || user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Session has been revoked');
    }

    request.user = {
      ...payload,
      permissions: getEffectivePermissions(user),
    };
    return true;
  }
}

function extractToken(request: Request): string | null {
  const cookieToken = (request.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE
  ];
  if (cookieToken) return cookieToken;
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return null;
}
