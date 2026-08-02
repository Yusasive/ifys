import { ConfigService } from '@nestjs/config';
import { FlutterwaveProvider } from './flutterwave.provider';

const WEBHOOK_HASH = 'unit_test_webhook_hash';

describe('FlutterwaveProvider.verifyWebhookSignature', () => {
  const provider = new FlutterwaveProvider(
    new ConfigService({ FLUTTERWAVE_WEBHOOK_HASH: WEBHOOK_HASH }),
  );

  it('accepts a header matching the configured secret hash', () => {
    expect(
      provider.verifyWebhookSignature(Buffer.from('{}'), WEBHOOK_HASH),
    ).toBe(true);
  });

  it('rejects a header that does not match the configured secret hash', () => {
    expect(
      provider.verifyWebhookSignature(Buffer.from('{}'), 'not-the-secret'),
    ).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(provider.verifyWebhookSignature(Buffer.from('{}'), undefined)).toBe(
      false,
    );
  });
});
