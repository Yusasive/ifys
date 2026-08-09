import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateVolunteerApplicationDto } from './dto/create-volunteer-application.dto';
import { VolunteerApplicationsService } from './volunteer-applications.service';

@Controller('volunteer-applications')
export class VolunteerApplicationsController {
  constructor(private readonly applications: VolunteerApplicationsService) {}

  @Get('status')
  getStatus(@Query('event') eventSlug: string) {
    return this.applications.getStatus(eventSlug);
  }

  @Post()
  create(@Body() dto: CreateVolunteerApplicationDto) {
    return this.applications.create(dto);
  }
}
