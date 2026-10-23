import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BroadcastsService } from './broadcasts.service';
import { UnsubscribeDto } from './dto/unsubscribe.dto';

// Public: reached from the link in a broadcast's footer and from mail
// clients' one-click "Unsubscribe" button (via the frontend's forwarder).
@Controller('email/unsubscribe')
export class UnsubscribeController {
  constructor(private readonly broadcasts: BroadcastsService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.broadcasts.unsubscribe(dto.email, dto.token);
  }
}
