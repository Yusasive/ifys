import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';
import { BroadcastAudienceDto } from './broadcast-audience.dto';
import { BroadcastContentDto } from './broadcast-content.dto';

export class SendBroadcastDto extends BroadcastContentDto {
  @IsString()
  eventSlug!: string;

  @ValidateNested()
  @Type(() => BroadcastAudienceDto)
  audience!: BroadcastAudienceDto;
}
