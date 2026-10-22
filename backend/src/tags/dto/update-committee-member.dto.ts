import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateCommitteeMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;
}
