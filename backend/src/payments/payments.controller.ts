import {
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('registrations/:id/checkout')
  checkout(@Param('id') id: string) {
    return this.payments.createCheckout(id);
  }

  @Post('webhooks/flutterwave')
  @HttpCode(200)
  flutterwaveWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('verif-hash') signature: string | undefined,
  ) {
    if (!req.rawBody) {
      throw new Error(
        'Raw body not captured — is `rawBody: true` set in main.ts?',
      );
    }
    return this.payments.handleFlutterwaveWebhook(req.rawBody, signature);
  }
}
