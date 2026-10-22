import 'dotenv/config';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CouponsService } from '../coupons/coupons.service';
import { StudentReviewEmailQueue } from '../email/student-review-email.queue';
import { WhatsAppInviteEmailQueue } from '../email/whatsapp-invite-email.queue';
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createPaidCheckoutFixture } from '../testing/fixtures';
import { TicketsService } from '../tickets/tickets.service';
import { PaystackProvider } from './paystack.provider';
import { PaymentsService } from './payments.service';

const studentReviewEmailQueue = {
  enqueue: jest.fn().mockResolvedValue(undefined),
  enqueueAdminNotify: jest.fn().mockResolvedValue(undefined),
} as unknown as StudentReviewEmailQueue;
const whatsAppInviteQueue = {
  enqueueForNewTicket: jest.fn().mockResolvedValue(undefined),
} as unknown as WhatsAppInviteEmailQueue;

describe('Coupon checkout (integration)', () => {
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

  async function withCoupon(
    data: Omit<Prisma.CouponUncheckedCreateInput, 'eventId'>,
    run: (
      fixture: Awaited<ReturnType<typeof createPaidCheckoutFixture>>,
      couponId: string,
    ) => Promise<void>,
  ) {
    const fixture = await createPaidCheckoutFixture(prisma);
    const coupon = await prisma.coupon.create({
      data: { ...data, eventId: fixture.event.id },
    });
    try {
      await run(fixture, coupon.id);
    } finally {
      await prisma.registration.update({
        where: { id: fixture.registration.id },
        data: { couponId: null },
      });
      await prisma.coupon.delete({ where: { id: coupon.id } });
      await fixture.teardown();
    }
  }

  it('settles a 100% coupon without calling Paystack and issues the ticket', async () => {
    await withCoupon(
      { code: 'FREE100', discountType: 'percent', discountValue: 100 },
      async (fixture, couponId) => {
        await prisma.registration.update({
          where: { id: fixture.registration.id },
          data: { couponId },
        });
        const fetchMock = jest.fn();
        global.fetch = fetchMock;
        const enqueueMock = jest.fn().mockResolvedValue(undefined);
        const payments = new PaymentsService(
          prisma,
          config,
          paystack,
          tickets,
          { enqueue: enqueueMock } as unknown as TicketEmailQueue,
          coupons,
          studentReviewEmailQueue,
          whatsAppInviteQueue,
        );

        const result = await payments.createCheckout(
          fixture.registration.id,
          fixture.registration.lookupToken,
        );

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.authorizationUrl).toContain('/register/confirmation');

        const order = await prisma.order.findUniqueOrThrow({
          where: { registrationId: fixture.registration.id },
        });
        expect(order.status).toBe('paid');
        expect(order.provider).toBe('free');
        expect(order.amountMinor).toBe(0);

        const registration = await prisma.registration.findUniqueOrThrow({
          where: { id: fixture.registration.id },
        });
        expect(registration.discountAppliedKobo).toBe(100000);

        const coupon = await prisma.coupon.findUniqueOrThrow({
          where: { id: couponId },
        });
        expect(coupon.redemptionCount).toBe(1);
        expect(enqueueMock).toHaveBeenCalledTimes(1);

        await expect(
          payments.createCheckout(
            fixture.registration.id,
            fixture.registration.lookupToken,
          ),
        ).rejects.toThrow();
      },
    );
  });

  it('rejects a coupon for a category it is not assigned to', async () => {
    await withCoupon(
      {
        code: 'STUDENTS',
        discountType: 'percent',
        discountValue: 20,
        categories: ['student'],
      },
      async (fixture) => {
        await expect(
          coupons.findRedeemableCoupon(
            fixture.event.id,
            'students',
            'professional',
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          coupons.findRedeemableCoupon(fixture.event.id, 'students', 'student'),
        ).resolves.toMatchObject({ code: 'STUDENTS' });
      },
    );
  });

  it('only lets claimRedemption succeed while redemptions remain', async () => {
    await withCoupon(
      {
        code: 'ONCE',
        discountType: 'percent',
        discountValue: 100,
        maxRedemptions: 1,
      },
      async (_fixture, couponId) => {
        expect(await coupons.claimRedemption(couponId)).toBe(true);
        expect(await coupons.claimRedemption(couponId)).toBe(false);
      },
    );
  });

  it('applies the coupon on top of an active early-bird price', () => {
    const quote = coupons.quote(
      {
        priceKobo: 100000,
        discountPercent: 50,
        discountExpiresAt: new Date(Date.now() + 60_000),
      },
      { discountType: 'percent', discountValue: 10 },
    );
    expect(quote).toEqual({
      basePriceKobo: 100000,
      earlyBirdKobo: 50000,
      couponKobo: 5000,
      finalPriceKobo: 45000,
      totalDiscountKobo: 55000,
    });
  });
});
