import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CouponsModule } from '../coupons/coupons.module';
import { EmailModule } from '../email/email.module';
import { NewsletterModule } from '../newsletter/newsletter.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { SpeakersModule } from '../speakers/speakers.module';
import { SponsorsModule } from '../sponsors/sponsors.module';
import { TicketsModule } from '../tickets/tickets.module';
import { VolunteersModule } from '../volunteers/volunteers.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ExportQueue } from './export.queue';

@Module({
  imports: [
    AuthModule,
    TicketsModule,
    EmailModule,
    SpeakersModule,
    SponsorsModule,
    NewsletterModule,
    RegistrationsModule,
    CouponsModule,
    VolunteersModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, ExportQueue],
})
export class AdminModule {}
