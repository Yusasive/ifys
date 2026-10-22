import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCommitteePositionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
