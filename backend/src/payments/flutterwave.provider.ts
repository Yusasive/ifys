import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import {
  InitializeTransactionParams,
  InitializeTransactionResult,
  PaymentProvider,
  VerifyTransactionResult,
} from './payment-provider.interface';

const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

interface FlutterwaveInitializeResponse {
  status: string;
  message: string;
  data?: {
    link: string;
  };
}

interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data?: {
    status: string;
    tx_ref: string;
    amount: number;
    currency: string;
  };
}

// Flutterwave's amount field is in the currency's major unit (naira), not
// kobo — the rest of this codebase stores/derives amounts in kobo
// (TicketProduct.priceKobo, Order.amountMinor), so conversion happens only
// at this API boundary.
function minorToMajor(amountMinor: number): number {
  return amountMinor / 100;
}

function majorToMinor(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

@Injectable()
export class FlutterwaveProvider implements PaymentProvider {
  private readonly logger = new Logger(FlutterwaveProvider.name);

  constructor(private readonly config: ConfigService) {}

  async initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult> {
    const secretKey = this.config.getOrThrow<string>('FLUTTERWAVE_SECRET_KEY');
    const res = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: params.reference,
        amount: minorToMajor(params.amountMinor),
        currency: 'NGN',
        redirect_url: params.callbackUrl,
        customer: { email: params.email },
      }),
    });

    const body = (await res.json()) as FlutterwaveInitializeResponse;
    if (!res.ok || body.status !== 'success' || !body.data) {
      this.logger.error(
        `Flutterwave initialize failed: ${JSON.stringify(body)}`,
      );
      throw new Error(`Flutterwave initialize failed: ${body.message}`);
    }

    return {
      authorizationUrl: body.data.link,
      reference: params.reference,
    };
  }

  // Flutterwave webhooks are authenticated with a static secret hash you
  // configure in the dashboard, echoed back verbatim in the `verif-hash`
  // header — unlike Paystack, it is not an HMAC of the body, just a shared
  // secret to compare.
  verifyWebhookSignature(
    _rawBody: Buffer,
    signatureHeader: string | undefined,
  ): boolean {
    if (!signatureHeader) return false;
    const expected = this.config.getOrThrow<string>('FLUTTERWAVE_WEBHOOK_HASH');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(signatureHeader, 'utf8');
    if (expectedBuf.length !== providedBuf.length) return false;
    return timingSafeEqual(expectedBuf, providedBuf);
  }

  // Flutterwave's own guidance: the webhook hash alone confirms the
  // request came from Flutterwave, not that the transaction actually
  // succeeded for the amount expected — always re-verify server-side
  // against their API before crediting anything.
  async verifyTransaction(
    transactionId: string,
  ): Promise<VerifyTransactionResult> {
    const secretKey = this.config.getOrThrow<string>('FLUTTERWAVE_SECRET_KEY');
    const res = await fetch(
      `${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/verify`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );

    const body = (await res.json()) as FlutterwaveVerifyResponse;
    if (!res.ok || body.status !== 'success' || !body.data) {
      this.logger.error(`Flutterwave verify failed: ${JSON.stringify(body)}`);
      throw new Error(`Flutterwave verify failed: ${body.message}`);
    }

    return {
      successful: body.data.status === 'successful',
      reference: body.data.tx_ref,
      amountMinor: majorToMinor(body.data.amount),
      currency: body.data.currency,
    };
  }
}
