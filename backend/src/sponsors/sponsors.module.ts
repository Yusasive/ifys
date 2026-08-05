import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { SponsorApplicationsController } from './sponsor-applications.controller';
import { SponsorApplicationsService } from './sponsor-applications.service';
import { SponsorsController } from './sponsors.controller';
import { SponsorsService } from './sponsors.service';

@Module({
  imports: [EmailModule],
  controllers: [SponsorsController, SponsorApplicationsController],
  providers: [SponsorsService, SponsorApplicationsService],
  exports: [SponsorsService, SponsorApplicationsService],
})
export class SponsorsModule {}
