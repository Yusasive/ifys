import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from './jwt-auth.guard';
import { PermissionKey } from './permissions';
import { PERMISSIONS_KEY } from './require-permissions.decorator';

// Runs after JwtAuthGuard/RolesGuard (see @UseGuards ordering on each
// route) — reads req.user.permissions, the effective set JwtAuthGuard
// already computed for this request. A route with no @RequirePermissions
// is unaffected (mirrors RolesGuard's "no @Roles => allow" behavior), so
// this guard only ever narrows access further within a role, never widens
// it — the class-level @Roles(...) boundary is unchanged.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionKey[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const granted = request.user.permissions ?? [];
    const hasAll = requiredPermissions.every((p) => granted.includes(p));
    if (!hasAll) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    return true;
  }
}
