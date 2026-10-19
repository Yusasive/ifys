import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';
import { BroadcastAudienceDto } from './broadcast-audience.dto';

export class PreviewAudienceDto {
  @IsString()
  eventSlug!: string;

  @ValidateNested()
  @Type(() => BroadcastAudienceDto)
  audience!: BroadcastAudienceDto;
}
