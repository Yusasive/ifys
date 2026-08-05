import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PaystackProvider } from './paystack.provider';

const SECRET = 'sk_test_unit_test_secret';

function sign(body: string): string {
  return createHmac('sha512', SECRET).update(body).digest('hex');
}

describe('PaystackProvider.verifyWebhookSignature', () => {
  const provider = new PaystackProvider(
    new ConfigService({ PAYSTACK_SECRET_KEY: SECRET }),
  );

  it('accepts a correctly signed body', () => {
    const body = JSON.stringify({ event: 'charge.success' });
    const signature = sign(body);
    expect(provider.verifyWebhookSignature(Buffer.from(body), signature)).toBe(
      true,
    );
  });

  it('rejects a tampered body', () => {
    const body = JSON.stringify({ event: 'charge.success' });
    const signature = sign(body);
    const tampered = JSON.stringify({ event: 'charge.success', extra: 1 });
    expect(
      provider.verifyWebhookSignature(Buffer.from(tampered), signature),
    ).toBe(false);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const body = JSON.stringify({ event: 'charge.success' });
    const wrongSignature = createHmac('sha512', 'wrong-secret')
      .update(body)
      .digest('hex');
    expect(
      provider.verifyWebhookSignature(Buffer.from(body), wrongSignature),
    ).toBe(false);
  });

  it('rejects a missing signature header', () => {
    const body = JSON.stringify({ event: 'charge.success' });
    expect(provider.verifyWebhookSignature(Buffer.from(body), undefined)).toBe(
      false,
    );
  });
});
