import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { StudentIdUploadUrlDto } from './dto/upload-url.dto';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get('ticket-products')
  listTicketProducts(@Query('event') eventSlug: string) {
    return this.registrations.listTicketProducts(eventSlug);
  }

  @Post('student-id-upload-url')
  createStudentIdUploadUrl(@Body() dto: StudentIdUploadUrlDto) {
    return this.registrations.createStudentIdUploadUrl(dto);
  }

  @Post()
  create(@Body() dto: CreateRegistrationDto) {
    return this.registrations.createRegistration(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Query('token') token?: string) {
    return this.registrations.findById(id, token);
  }
}
