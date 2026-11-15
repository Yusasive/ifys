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

  @IsOptional()
  @IsIn(PERMISSION_KEYS, { each: true })
  permissions?: PermissionKey[];

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
