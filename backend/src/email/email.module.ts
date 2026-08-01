import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { TicketEmailQueue } from './ticket-email.queue';

@Module({
  providers: [EmailService, TicketEmailQueue],
  exports: [EmailService, TicketEmailQueue],
})
export class EmailModule {}
