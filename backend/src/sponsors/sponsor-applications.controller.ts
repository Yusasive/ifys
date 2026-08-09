import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateSponsorApplicationDto } from './dto/create-sponsor-application.dto';
import { SponsorApplicationUploadUrlDto } from './dto/sponsor-application-upload-url.dto';
import { SponsorApplicationsService } from './sponsor-applications.service';

@Controller('sponsor-applications')
export class SponsorApplicationsController {
  constructor(private readonly applications: SponsorApplicationsService) {}

  @Get('status')
  getStatus(@Query('event') eventSlug: string) {
    return this.applications.getStatus(eventSlug);
  }

  @Post('upload-url')
  createUploadUrl(@Body() dto: SponsorApplicationUploadUrlDto) {
    return this.applications.createUploadUrl(dto);
  }

  @Post()
  create(@Body() dto: CreateSponsorApplicationDto) {
    return this.applications.create(dto);
  }
}
