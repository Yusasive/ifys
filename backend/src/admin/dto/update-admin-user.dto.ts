import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AdminRole } from '../../generated/prisma/enums';
import { NormalizeEmail } from '../../auth/normalize-email.decorator';

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
}
