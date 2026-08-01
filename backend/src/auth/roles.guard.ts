import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../generated/prisma/enums';
import { AuthenticatedRequest } from './jwt-auth.guard';
import { ROLES_KEY } from './roles.decorator';

// Runs after JwtAuthGuard (see @UseGuards ordering on each route) — reads
// req.user set by the auth guard, so a missing/invalid token has already
// been rejected before role scoping is even considered. Door staff (or
// any role not listed via @Roles(...)) get a 403, never organizer-only
// data — TRD §11 priority 5.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    return true;
  }
}
