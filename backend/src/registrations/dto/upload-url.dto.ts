import { IsIn, IsString, MinLength } from 'class-validator';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

export class StudentIdUploadUrlDto {
  @IsString()
  @MinLength(1)
  fileName!: string;

  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: string;
}
