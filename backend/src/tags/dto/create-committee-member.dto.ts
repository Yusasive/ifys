import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCommitteeMemberDto {
  @IsString()
  eventSlug!: string;

  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsUUID()
  positionId!: string;
}
