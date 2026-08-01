export interface InitializeTransactionParams {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

// TRD §2: keep the payment integration behind an interface so a second
// provider (Flutterwave) can be added later without touching callers.
export interface PaymentProvider {
  initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult>;

  verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): boolean;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
