import {
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('registrations/:id/checkout')
  checkout(@Param('id') id: string, @Query('token') token?: string) {
    return this.payments.createCheckout(id, token);
  }

  // Fallback for when the Paystack webhook never lands — the confirmation
  // page calls this on load (and the caller must hold the registration's
  // lookup token) instead of only ever waiting passively for the webhook.
  // Throttled tighter than the app default since every call that finds a
  // still-pending order makes an outbound verify call to Paystack.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('registrations/:id/verify-payment')
  verifyPayment(@Param('id') id: string, @Query('token') token?: string) {
    return this.payments.verifyRegistrationPayment(id, token);
  }

  @Post('webhooks/paystack')
  @HttpCode(200)
  paystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string | undefined,
  ) {
    if (!req.rawBody) {
      throw new Error(
        'Raw body not captured — is `rawBody: true` set in main.ts?',
      );
    }
    return this.payments.handlePaystackWebhook(req.rawBody, signature);
  }
}
