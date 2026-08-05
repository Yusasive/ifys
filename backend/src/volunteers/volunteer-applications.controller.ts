import { Body, Controller, Post } from '@nestjs/common';
import { CreateVolunteerApplicationDto } from './dto/create-volunteer-application.dto';
import { VolunteerApplicationsService } from './volunteer-applications.service';

@Controller('volunteer-applications')
export class VolunteerApplicationsController {
  constructor(private readonly applications: VolunteerApplicationsService) {}

  @Post()
  create(@Body() dto: CreateVolunteerApplicationDto) {
    return this.applications.create(dto);
  }
}
