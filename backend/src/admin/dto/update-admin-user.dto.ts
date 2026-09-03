import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AdminRole } from '../../generated/prisma/enums';
import { NormalizeEmail } from '../../auth/normalize-email.decorator';
import { PERMISSION_KEYS, PermissionKey } from '../../auth/permissions';

// Same manageable-role restriction as CreateAdminUserDto — super_admin is
// never assignable through this endpoint, only seed/bootstrap-created.
const ROLES: AdminRole[] = ['organizer', 'door_staff'];

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: AdminRole;

  @IsOptional()
  @IsBoolean()
  notifyOnStudentRegistration?: boolean;

  // Omitted + no role change => permissions untouched. Omitted + role
  // changed => AdminService.updateAdminUser resets to the new role's
  // defaults (prevents a promoted/demoted account keeping a stale set).
  // Provided => used as-is, replacing whatever this admin had before.
  @IsOptional()
  @IsIn(PERMISSION_KEYS, { each: true })
  permissions?: PermissionKey[];
}
