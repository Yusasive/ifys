import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { AdminRole } from '../../generated/prisma/enums';
import { NormalizeEmail } from '../../auth/normalize-email.decorator';

const ROLES: AdminRole[] = ['organizer', 'door_staff'];

export class CreateAdminUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password!: string;

  @IsIn(ROLES)
  role!: AdminRole;
}
