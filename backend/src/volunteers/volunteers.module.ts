import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { VolunteerApplicationsController } from './volunteer-applications.controller';
import { VolunteerApplicationsService } from './volunteer-applications.service';

@Module({
  imports: [EmailModule],
  controllers: [VolunteerApplicationsController],
  providers: [VolunteerApplicationsService],
  exports: [VolunteerApplicationsService],
})
export class VolunteersModule {}
