import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateVipGuestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  // An empty string clears the line from the tag.
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
