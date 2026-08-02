import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { TicketsModule } from '../tickets/tickets.module';
import { FlutterwaveProvider } from './flutterwave.provider';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TicketsModule, EmailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, FlutterwaveProvider],
})
export class PaymentsModule {}
