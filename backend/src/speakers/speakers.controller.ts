import { Controller, Get, Param, Query } from '@nestjs/common';
import { SpeakersService } from './speakers.service';

@Controller('speakers')
export class SpeakersController {
  constructor(private readonly speakers: SpeakersService) {}

  @Get()
  listPublic(@Query('event') eventSlug: string) {
    return this.speakers.listPublic(eventSlug);
  }

  @Get(':slug')
  getPublic(@Param('slug') slug: string) {
    return this.speakers.getPublicBySlug(slug);
  }
}
