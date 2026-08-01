import 'dotenv/config';
import { createHmac } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { createPaidCheckoutFixture } from '../testing/fixtures';
import { TicketsService } from '../tickets/tickets.service';
import { PaymentsService } from './payments.service';
import { PaystackProvider } from './paystack.provider';

function signBody(body: string): string {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error('PAYSTACK_SECRET_KEY not set — check backend/.env');
  }
  return createHmac('sha512', secret).update(body).digest('hex');
}

function chargeSuccessBody(reference: string, amountKobo: number): string {
  return JSON.stringify({
    event: 'charge.success',
    data: { reference, amount: amountKobo },
  });
}

function makeEmailQueueSpy() {
  const enqueueMock = jest.fn().mockResolvedValue(undefined);
  const emailQueue = { enqueue: enqueueMock } as unknown as TicketEmailQueue;
  return { emailQueue, enqueueMock };
}

describe('PaymentsService.handlePaystackWebhook (integration)', () => {
  const prisma = new PrismaService();
  const config = new ConfigService(process.env);
  const paystack = new PaystackProvider(config);
  const tickets = new TicketsService(prisma);

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
        paystack,
        tickets,
        emailQueue,
      );

      const body = chargeSuccessBody(
        fixture.order.providerReference,
        fixture.order.amountKobo,
      );

      await expect(
        payments.handlePaystackWebhook(
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
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        paystack,
        tickets,
        emailQueue,
      );

      const body = chargeSuccessBody(
        fixture.order.providerReference,
        fixture.order.amountKobo,
      );
      const signature = signBody(body);

      await payments.handlePaystackWebhook(Buffer.from(body), signature);
      await payments.handlePaystackWebhook(Buffer.from(body), signature);

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
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        paystack,
        tickets,
        emailQueue,
      );

      const body = chargeSuccessBody(
        fixture.order.providerReference,
        fixture.order.amountKobo,
      );
      const signature = signBody(body);

      await Promise.all([
        payments.handlePaystackWebhook(Buffer.from(body), signature),
        payments.handlePaystackWebhook(Buffer.from(body), signature),
        payments.handlePaystackWebhook(Buffer.from(body), signature),
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

  it('ignores events other than charge.success without side effects', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        paystack,
        tickets,
        emailQueue,
      );

      const body = JSON.stringify({
        event: 'charge.failed',
        data: {
          reference: fixture.order.providerReference,
          amount: fixture.order.amountKobo,
        },
      });
      const signature = signBody(body);

      await payments.handlePaystackWebhook(Buffer.from(body), signature);

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
