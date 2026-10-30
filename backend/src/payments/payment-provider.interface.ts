export interface InitializeTransactionParams {
  email: string;
  amountMinor: number;
  reference: string;
  callbackUrl: string;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  reference: string;
}

export interface VerifyTransactionResult {
  successful: boolean;
  reference: string;
  amountMinor: number;
  currency: string;
  // Paystack's payment channel (card, bank_transfer, ussd, ...), when given.
  channel: string | null;
}

export interface PaymentProvider {
  initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult>;

  verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): boolean;

  verifyTransaction(transactionId: string): Promise<VerifyTransactionResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
