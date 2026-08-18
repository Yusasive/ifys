import { Module } from '@nestjs/common';
import { AdminAccountEmailQueue } from './admin-account-email.queue';
import { EmailService } from './email.service';
import { NewsletterEmailQueue } from './newsletter-email.queue';
import { RegistrationReminderEmailQueue } from './registration-reminder-email.queue';
import { SponsorApplicationEmailQueue } from './sponsor-application-email.queue';
import { TicketEmailQueue } from './ticket-email.queue';
import { VolunteerApplicationEmailQueue } from './volunteer-application-email.queue';

@Module({
  providers: [
    EmailService,
    TicketEmailQueue,
    SponsorApplicationEmailQueue,
    NewsletterEmailQueue,
    VolunteerApplicationEmailQueue,
    AdminAccountEmailQueue,
    RegistrationReminderEmailQueue,
  ],
  exports: [
    EmailService,
    TicketEmailQueue,
    SponsorApplicationEmailQueue,
    NewsletterEmailQueue,
    VolunteerApplicationEmailQueue,
    AdminAccountEmailQueue,
    RegistrationReminderEmailQueue,
  ],
})
export class EmailModule {}
