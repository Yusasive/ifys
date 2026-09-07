import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AdminRole } from '../../generated/prisma/enums';
import { NormalizeEmail } from '../../auth/normalize-email.decorator';
import { PERMISSION_KEYS, PermissionKey } from '../../auth/permissions';

// super_admin IS assignable here (promoting an existing organizer/door_staff
// — see AdminService.updateAdminUser), but only as a target: the service
// separately still refuses to modify a row that's ALREADY super_admin, so
// this is a one-way promotion path, never a way to edit or demote one.
const ROLES: AdminRole[] = ['organizer', 'door_staff', 'super_admin'];

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

  // Required only when promoting someone to super_admin — the highest
  // privilege in the system, so it gets the same re-auth + reason
  // requirement as the ticket lifecycle's most destructive actions
  // (void/withdraw), re-verified against the ACTING super_admin's own
  // password, not the target account's.
  @ValidateIf((o: UpdateAdminUserDto) => o.role === 'super_admin')
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;

  @ValidateIf((o: UpdateAdminUserDto) => o.role === 'super_admin')
  @IsString()
  @IsNotEmpty()
  password?: string;
}
