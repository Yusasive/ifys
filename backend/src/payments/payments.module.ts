import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { TicketsModule } from '../tickets/tickets.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaystackProvider } from './paystack.provider';

@Module({
  imports: [TicketsModule, EmailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaystackProvider],
})
export class PaymentsModule {}
