import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  InitializeTransactionParams,
  InitializeTransactionResult,
  PaymentProvider,
  VerifyTransactionResult,
} from './payment-provider.interface';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
  };
}

@Injectable()
export class PaystackProvider implements PaymentProvider {
  private readonly logger = new Logger(PaystackProvider.name);

  constructor(private readonly config: ConfigService) {}

  async initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult> {
    const secretKey = this.config.getOrThrow<string>('PAYSTACK_SECRET_KEY');
    const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        amount: params.amountMinor,
        reference: params.reference,
        callback_url: params.callbackUrl,
      }),
    });

    const body = (await res.json()) as PaystackInitializeResponse;
    if (!res.ok || !body.status || !body.data) {
      this.logger.error(`Paystack initialize failed: ${JSON.stringify(body)}`);
      throw new Error(`Paystack initialize failed: ${body.message}`);
    }

    return {
      authorizationUrl: body.data.authorization_url,
      reference: body.data.reference,
    };
  }

  verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): boolean {
    if (!signatureHeader) return false;
    const secretKey = this.config.getOrThrow<string>('PAYSTACK_SECRET_KEY');
    const expected = createHmac('sha512', secretKey)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(signatureHeader, 'utf8');
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    const secretKey = this.config.getOrThrow<string>('PAYSTACK_SECRET_KEY');
    const res = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );

    const body = (await res.json()) as PaystackVerifyResponse;
    if (!res.ok || !body.status || !body.data) {
      this.logger.error(`Paystack verify failed: ${JSON.stringify(body)}`);
      throw new Error(`Paystack verify failed: ${body.message}`);
    }

    return {
      successful: body.data.status === 'success',
      reference: body.data.reference,
      amountMinor: body.data.amount,
      currency: body.data.currency,
    };
  }
}
