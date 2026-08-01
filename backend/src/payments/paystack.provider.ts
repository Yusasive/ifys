import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  InitializeTransactionParams,
  InitializeTransactionResult,
  PaymentProvider,
} from './payment-provider.interface';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
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
        amount: params.amountKobo,
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
      accessCode: body.data.access_code,
      reference: body.data.reference,
    };
  }

  // Paystack signs the raw request body with HMAC-SHA512 using the secret
  // key; the caller must pass the exact bytes received on the wire (not a
  // re-serialized JSON.stringify of the parsed body — field order/spacing
  // differences would break the signature).
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
}
