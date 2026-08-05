import { Module } from '@nestjs/common';
import { CouponsModule } from '../coupons/coupons.module';
import { EmailModule } from '../email/email.module';
import { TicketsModule } from '../tickets/tickets.module';
import { PaystackProvider } from './paystack.provider';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TicketsModule, EmailModule, CouponsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaystackProvider],
})
export class PaymentsModule {}
