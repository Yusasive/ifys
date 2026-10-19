import { IsString } from 'class-validator';
import { BroadcastContentDto } from './broadcast-content.dto';

export class TestBroadcastDto extends BroadcastContentDto {
  @IsString()
  eventSlug!: string;
}
