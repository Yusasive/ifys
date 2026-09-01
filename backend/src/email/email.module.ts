import { Module } from '@nestjs/common';
import { AdminAccountEmailQueue } from './admin-account-email.queue';
import { EmailService } from './email.service';
import { NewsletterEmailQueue } from './newsletter-email.queue';
import { RegistrationReminderEmailQueue } from './registration-reminder-email.queue';
import { SponsorApplicationEmailQueue } from './sponsor-application-email.queue';
import { StudentReviewEmailQueue } from './student-review-email.queue';
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
    StudentReviewEmailQueue,
  ],
  exports: [
    EmailService,
    TicketEmailQueue,
    SponsorApplicationEmailQueue,
    NewsletterEmailQueue,
    VolunteerApplicationEmailQueue,
    AdminAccountEmailQueue,
    RegistrationReminderEmailQueue,
    StudentReviewEmailQueue,
  ],
})
export class EmailModule {}
