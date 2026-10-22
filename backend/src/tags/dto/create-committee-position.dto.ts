import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCommitteePositionDto {
  @IsString()
  eventSlug!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
