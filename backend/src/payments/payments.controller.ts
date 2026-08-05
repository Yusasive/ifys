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
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('registrations/:id/checkout')
  checkout(@Param('id') id: string, @Query('token') token?: string) {
    return this.payments.createCheckout(id, token);
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
