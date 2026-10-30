import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateVipGuestDto {
  @IsString()
  eventSlug!: string;

  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
