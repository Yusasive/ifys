import { Controller, Get, Query } from '@nestjs/common';
import { SponsorsService } from './sponsors.service';

@Controller('sponsors')
export class SponsorsController {
  constructor(private readonly sponsors: SponsorsService) {}

  @Get()
  listPublic(@Query('event') eventSlug: string) {
    return this.sponsors.listPublic(eventSlug);
  }
}
