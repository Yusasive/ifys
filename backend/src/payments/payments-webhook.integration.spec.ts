import 'dotenv/config';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { createPaidCheckoutFixture } from '../testing/fixtures';
import { TicketsService } from '../tickets/tickets.service';
import { FlutterwaveProvider } from './flutterwave.provider';
import { PaymentsService } from './payments.service';

const WEBHOOK_HASH = process.env.FLUTTERWAVE_WEBHOOK_HASH;
if (!WEBHOOK_HASH) {
  throw new Error('FLUTTERWAVE_WEBHOOK_HASH not set — check backend/.env');
}

function chargeCompletedBody(
  transactionId: number,
  reference: string,
  status: string,
): string {
  return JSON.stringify({
    event: 'charge.completed',
    data: { id: transactionId, tx_ref: reference, status },
  });
}

function makeEmailQueueSpy() {
  const enqueueMock = jest.fn().mockResolvedValue(undefined);
  const emailQueue = { enqueue: enqueueMock } as unknown as TicketEmailQueue;
  return { emailQueue, enqueueMock };
}

// Flutterwave's recommended integration re-verifies every webhook against
// their API rather than trusting the payload — so these tests stub
// `fetch` to stand in for that call instead of hitting the real API.
function stubVerifyFetch(response: {
  status: string;
  tx_ref: string;
  amount: number;
  currency: string;
}) {
  const mock = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        status: 'success',
        message: 'ok',
        data: response,
      }),
  });
  global.fetch = mock;
  return mock;
}

describe('PaymentsService.handleFlutterwaveWebhook (integration)', () => {
  const prisma = new PrismaService();
  const config = new ConfigService(process.env);
  const flutterwave = new FlutterwaveProvider(config);
  const tickets = new TicketsService(prisma);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects a webhook with an invalid signature and leaves the order untouched', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        flutterwave,
        tickets,
        emailQueue,
      );

      const body = chargeCompletedBody(
        1,
        fixture.order.providerReference,
        'successful',
      );

      await expect(
        payments.handleFlutterwaveWebhook(
          Buffer.from(body),
          'not-a-real-signature',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: fixture.order.id },
      });
      expect(order.status).toBe('pending');
      expect(enqueueMock).not.toHaveBeenCalled();
    } finally {
      await fixture.teardown();
    }
  });

  it('is idempotent across duplicate deliveries of the same event', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      stubVerifyFetch({
        status: 'successful',
        tx_ref: fixture.order.providerReference,
        amount: fixture.order.amountMinor / 100,
        currency: fixture.order.currency,
      });
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        flutterwave,
        tickets,
        emailQueue,
      );

      const body = chargeCompletedBody(
        1,
        fixture.order.providerReference,
        'successful',
      );

      await payments.handleFlutterwaveWebhook(Buffer.from(body), WEBHOOK_HASH);
      await payments.handleFlutterwaveWebhook(Buffer.from(body), WEBHOOK_HASH);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: fixture.order.id },
      });
      expect(order.status).toBe('paid');

      const ticketCount = await prisma.ticket.count({
        where: { registrationId: fixture.registration.id },
      });
      expect(ticketCount).toBe(1);
      expect(enqueueMock).toHaveBeenCalledTimes(1);
    } finally {
      await fixture.teardown();
    }
  });

  // TRD §11 priority 1: a webhook firing twice concurrently — not just
  // sequentially — must still issue exactly one ticket and send exactly
  // one email.
  it('resolves concurrent duplicate deliveries to exactly one ticket and one email', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      stubVerifyFetch({
        status: 'successful',
        tx_ref: fixture.order.providerReference,
        amount: fixture.order.amountMinor / 100,
        currency: fixture.order.currency,
      });
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        flutterwave,
        tickets,
        emailQueue,
      );

      const body = chargeCompletedBody(
        1,
        fixture.order.providerReference,
        'successful',
      );

      await Promise.all([
        payments.handleFlutterwaveWebhook(Buffer.from(body), WEBHOOK_HASH),
        payments.handleFlutterwaveWebhook(Buffer.from(body), WEBHOOK_HASH),
        payments.handleFlutterwaveWebhook(Buffer.from(body), WEBHOOK_HASH),
      ]);

      const ticketCount = await prisma.ticket.count({
        where: { registrationId: fixture.registration.id },
      });
      expect(ticketCount).toBe(1);
      expect(enqueueMock).toHaveBeenCalledTimes(1);
    } finally {
      await fixture.teardown();
    }
  });

  it('ignores events other than a successful charge.completed without side effects', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        flutterwave,
        tickets,
        emailQueue,
      );

      const body = chargeCompletedBody(
        1,
        fixture.order.providerReference,
        'failed',
      );

      await payments.handleFlutterwaveWebhook(Buffer.from(body), WEBHOOK_HASH);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: fixture.order.id },
      });
      expect(order.status).toBe('pending');
      expect(enqueueMock).not.toHaveBeenCalled();
    } finally {
      await fixture.teardown();
    }
  });

  it('does not claim the order when server-side verification fails to confirm success', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      stubVerifyFetch({
        status: 'failed',
        tx_ref: fixture.order.providerReference,
        amount: fixture.order.amountMinor / 100,
        currency: fixture.order.currency,
      });
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        flutterwave,
        tickets,
        emailQueue,
      );

      const body = chargeCompletedBody(
        1,
        fixture.order.providerReference,
        'successful',
      );

      await payments.handleFlutterwaveWebhook(Buffer.from(body), WEBHOOK_HASH);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: fixture.order.id },
      });
      expect(order.status).toBe('pending');
      expect(enqueueMock).not.toHaveBeenCalled();
    } finally {
      await fixture.teardown();
    }
  });
});
