import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { NewsletterEmailQueue } from './newsletter-email.queue';
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
  ],
  exports: [
    EmailService,
    TicketEmailQueue,
    SponsorApplicationEmailQueue,
    NewsletterEmailQueue,
    VolunteerApplicationEmailQueue,
  ],
})
export class EmailModule {}
