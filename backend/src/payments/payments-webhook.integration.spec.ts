import 'dotenv/config';
import { createHmac } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CouponsService } from '../coupons/coupons.service';
import { StudentReviewEmailQueue } from '../email/student-review-email.queue';
import { WhatsAppInviteEmailQueue } from '../email/whatsapp-invite-email.queue';
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { createPaidCheckoutFixture } from '../testing/fixtures';
import { TicketsService } from '../tickets/tickets.service';
import { PaystackProvider } from './paystack.provider';
import { PaymentsService } from './payments.service';

function signBody(body: string): string {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error('PAYSTACK_SECRET_KEY not set — check backend/.env');
  }
  return createHmac('sha512', secret).update(body).digest('hex');
}

function chargeSuccessBody(reference: string, amountMinor: number): string {
  return JSON.stringify({
    event: 'charge.success',
    data: { reference, amount: amountMinor },
  });
}

function makeEmailQueueSpy() {
  const enqueueMock = jest.fn().mockResolvedValue(undefined);
  const emailQueue = { enqueue: enqueueMock } as unknown as TicketEmailQueue;
  return { emailQueue, enqueueMock };
}

const studentReviewEmailQueue = {
  enqueue: jest.fn().mockResolvedValue(undefined),
  enqueueAdminNotify: jest.fn().mockResolvedValue(undefined),
} as unknown as StudentReviewEmailQueue;
const whatsAppInviteQueue = {
  enqueueForNewTicket: jest.fn().mockResolvedValue(undefined),
} as unknown as WhatsAppInviteEmailQueue;

function stubVerifyFetch(response: {
  status: string;
  reference: string;
  amount: number;
  currency: string;
}) {
  const mock = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        status: true,
        message: 'ok',
        data: response,
      }),
  });
  global.fetch = mock;
  return mock;
}

describe('PaymentsService.handlePaystackWebhook (integration)', () => {
  const prisma = new PrismaService();
  const config = new ConfigService(process.env);
  const paystack = new PaystackProvider(config);
  const tickets = new TicketsService(prisma);
  const coupons = new CouponsService(prisma, new AuditLogService(prisma));
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
        paystack,
        tickets,
        emailQueue,
        coupons,
        studentReviewEmailQueue,
        whatsAppInviteQueue,
      );

      const body = chargeSuccessBody(
        fixture.order.providerReference,
        fixture.order.amountMinor,
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
      stubVerifyFetch({
        status: 'success',
        reference: fixture.order.providerReference,
        amount: fixture.order.amountMinor,
        currency: fixture.order.currency,
      });
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        paystack,
        tickets,
        emailQueue,
        coupons,
        studentReviewEmailQueue,
        whatsAppInviteQueue,
      );

      const body = chargeSuccessBody(
        fixture.order.providerReference,
        fixture.order.amountMinor,
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

  it('resolves concurrent duplicate deliveries to exactly one ticket and one email', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      stubVerifyFetch({
        status: 'success',
        reference: fixture.order.providerReference,
        amount: fixture.order.amountMinor,
        currency: fixture.order.currency,
      });
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        paystack,
        tickets,
        emailQueue,
        coupons,
        studentReviewEmailQueue,
        whatsAppInviteQueue,
      );

      const body = chargeSuccessBody(
        fixture.order.providerReference,
        fixture.order.amountMinor,
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
        coupons,
        studentReviewEmailQueue,
        whatsAppInviteQueue,
      );

      const body = JSON.stringify({
        event: 'charge.failed',
        data: {
          reference: fixture.order.providerReference,
          amount: fixture.order.amountMinor,
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

  it('does not claim the order when server-side verification fails to confirm success', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      stubVerifyFetch({
        status: 'failed',
        reference: fixture.order.providerReference,
        amount: fixture.order.amountMinor,
        currency: fixture.order.currency,
      });
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        paystack,
        tickets,
        emailQueue,
        coupons,
        studentReviewEmailQueue,
        whatsAppInviteQueue,
      );

      const body = chargeSuccessBody(
        fixture.order.providerReference,
        fixture.order.amountMinor,
      );
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

  it('holds the order for review and never issues a ticket when the verified amount does not match', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      stubVerifyFetch({
        status: 'success',
        reference: fixture.order.providerReference,
        amount: fixture.order.amountMinor - 100,
        currency: fixture.order.currency,
      });
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        paystack,
        tickets,
        emailQueue,
        coupons,
        studentReviewEmailQueue,
        whatsAppInviteQueue,
      );

      const body = chargeSuccessBody(
        fixture.order.providerReference,
        fixture.order.amountMinor - 100,
      );
      const signature = signBody(body);

      await payments.handlePaystackWebhook(Buffer.from(body), signature);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: fixture.order.id },
      });
      expect(order.status).toBe('amount_mismatch');
      expect(order.paidAt).toBeNull();

      const ticketCount = await prisma.ticket.count({
        where: { registrationId: fixture.registration.id },
      });
      expect(ticketCount).toBe(0);
      expect(enqueueMock).not.toHaveBeenCalled();
    } finally {
      await fixture.teardown();
    }
  });

  it('settles the order and issues a ticket when the verified amount is higher than expected', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      const overpaidAmount = fixture.order.amountMinor + 25381;
      stubVerifyFetch({
        status: 'success',
        reference: fixture.order.providerReference,
        amount: overpaidAmount,
        currency: fixture.order.currency,
      });
      const { emailQueue, enqueueMock } = makeEmailQueueSpy();
      const payments = new PaymentsService(
        prisma,
        config,
        paystack,
        tickets,
        emailQueue,
        coupons,
        studentReviewEmailQueue,
        whatsAppInviteQueue,
      );

      const body = chargeSuccessBody(
        fixture.order.providerReference,
        overpaidAmount,
      );
      const signature = signBody(body);

      await payments.handlePaystackWebhook(Buffer.from(body), signature);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: fixture.order.id },
      });
      expect(order.status).toBe('paid');
      expect(order.paidAt).not.toBeNull();
      expect(order.amountMinor).toBe(overpaidAmount);

      const ticketCount = await prisma.ticket.count({
        where: { registrationId: fixture.registration.id },
      });
      expect(ticketCount).toBe(1);
      expect(enqueueMock).toHaveBeenCalledTimes(1);
    } finally {
      await fixture.teardown();
    }
  });
});
