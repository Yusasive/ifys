import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BroadcastContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MaxLength(50_000)
  bodyHtml!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ctaLabel?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  ctaUrl?: string;
}
