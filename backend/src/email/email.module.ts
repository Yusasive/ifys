import { Module } from '@nestjs/common';
import { AdminAccountEmailQueue } from './admin-account-email.queue';
import { BroadcastEmailQueue } from './broadcast-email.queue';
import { EmailService } from './email.service';
import { NewsletterEmailQueue } from './newsletter-email.queue';
import { RegistrationReminderEmailQueue } from './registration-reminder-email.queue';
import { SponsorApplicationEmailQueue } from './sponsor-application-email.queue';
import { StudentReviewEmailQueue } from './student-review-email.queue';
import { TicketEmailQueue } from './ticket-email.queue';
import { TicketLifecycleEmailQueue } from './ticket-lifecycle-email.queue';
import { VolunteerApplicationEmailQueue } from './volunteer-application-email.queue';
import { WhatsAppInviteEmailQueue } from './whatsapp-invite-email.queue';

@Module({
  providers: [
    EmailService,
    TicketEmailQueue,
    TicketLifecycleEmailQueue,
    SponsorApplicationEmailQueue,
    NewsletterEmailQueue,
    VolunteerApplicationEmailQueue,
    AdminAccountEmailQueue,
    RegistrationReminderEmailQueue,
    StudentReviewEmailQueue,
    BroadcastEmailQueue,
    WhatsAppInviteEmailQueue,
  ],
  exports: [
    EmailService,
    TicketEmailQueue,
    TicketLifecycleEmailQueue,
    SponsorApplicationEmailQueue,
    NewsletterEmailQueue,
    VolunteerApplicationEmailQueue,
    AdminAccountEmailQueue,
    RegistrationReminderEmailQueue,
    StudentReviewEmailQueue,
    BroadcastEmailQueue,
    WhatsAppInviteEmailQueue,
  ],
})
export class EmailModule {}
