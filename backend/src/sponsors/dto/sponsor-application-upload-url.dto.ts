import { IsIn, IsString, MinLength } from 'class-validator';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class SponsorApplicationUploadUrlDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: string;
}
