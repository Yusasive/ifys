import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { CouponsService } from '../coupons/coupons.service';
import { Coupon } from '../generated/prisma/client';
import { StudentReviewEmailQueue } from '../email/student-review-email.queue';
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { WhatsAppInviteEmailQueue } from '../email/whatsapp-invite-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { matchesLookupToken } from '../registrations/registrations.service';
import { TicketsService } from '../tickets/tickets.service';
import { PaystackProvider } from './paystack.provider';

interface PaystackChargeEvent {
  event: string;
  data?: {
    reference?: string;
    amount?: number;
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly paystack: PaystackProvider,
    private readonly tickets: TicketsService,
    private readonly emailQueue: TicketEmailQueue,
    private readonly coupons: CouponsService,
    private readonly studentReviewEmailQueue: StudentReviewEmailQueue,
    private readonly whatsAppInviteQueue: WhatsAppInviteEmailQueue,
  ) {}

  async createCheckout(registrationId: string, token?: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        attendee: true,
        ticketProduct: true,
        coupon: true,
        order: true,
      },
    });
    if (!registration || !matchesLookupToken(registration.lookupToken, token)) {
      throw new NotFoundException('Registration not found');
    }
    if (
      registration.status === 'paid' ||
      registration.order?.status === 'paid'
    ) {
      throw new ConflictException(
        'This registration has already been paid for.',
      );
    }

    let coupon: Coupon | null = null;
    if (registration.couponId) {
      coupon = await this.coupons
        .findRedeemableCoupon(
          registration.eventId,
          registration.coupon!.code,
          registration.ticketProduct.category,
        )
        .catch(() => null);
      // The code stopped being redeemable since registration (expired,
      // deactivated, limit hit) — drop it so settlement doesn't count a
      // redemption for a discount that was never applied.
      if (!coupon) {
        await this.prisma.registration.update({
          where: { id: registration.id },
          data: { couponId: null },
        });
      }
    }
    const quote = this.coupons.quote(registration.ticketProduct, coupon);
    const finalAmount = quote.finalPriceKobo;
    const totalDiscount = quote.totalDiscountKobo;

    const callbackUrl = `${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/register/confirmation?registration=${registration.id}&token=${registration.lookupToken}`;

    if (finalAmount === 0) {
      return this.completeFreeCheckout(
        registration.id,
        registration.ticketProduct.currency,
        coupon?.id ?? null,
        totalDiscount,
        callbackUrl,
      );
    }

    const reference = `ify-${registration.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;

    const { authorizationUrl } = await this.paystack.initializeTransaction({
      email: registration.attendee.email,
      amountMinor: finalAmount,
      reference,
      callbackUrl,
    });

    await this.prisma.registration.update({
      where: { id: registration.id },
      data: { discountAppliedKobo: totalDiscount },
    });

    await this.prisma.order.upsert({
      where: { registrationId: registration.id },
      update: {
        providerReference: reference,
        status: 'pending',
        amountMinor: finalAmount,
        currency: registration.ticketProduct.currency,
      },
      create: {
        registrationId: registration.id,
        amountMinor: finalAmount,
        currency: registration.ticketProduct.currency,
        provider: 'paystack',
        providerReference: reference,
        status: 'pending',
      },
    });

    return { authorizationUrl, reference };
  }

  // Nothing to charge (e.g. a 100% coupon), so Paystack is skipped
  // entirely — it rejects zero-amount transactions. The order is settled
  // right here and the client is sent straight to the confirmation page,
  // which then sees the registration as paid/pending_review as usual.
  private async completeFreeCheckout(
    registrationId: string,
    currency: string,
    couponId: string | null,
    totalDiscount: number,
    callbackUrl: string,
  ) {
    const reference = `ify-free-${registrationId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;

    await this.prisma.order.upsert({
      where: { registrationId },
      update: {
        providerReference: reference,
        provider: 'free',
        status: 'pending',
        amountMinor: 0,
        currency,
      },
      create: {
        registrationId,
        amountMinor: 0,
        currency,
        provider: 'free',
        providerReference: reference,
        status: 'pending',
      },
    });

    if (couponId && !(await this.coupons.claimRedemption(couponId))) {
      await this.prisma.order.updateMany({
        where: { providerReference: reference, status: 'pending' },
        data: { status: 'failed' },
      });
      throw new BadRequestException(
        'This coupon code has reached its redemption limit.',
      );
    }

    const claim = await this.prisma.order.updateMany({
      where: { providerReference: reference, status: 'pending' },
      data: { status: 'paid', paidAt: new Date() },
    });
    if (claim.count === 1) {
      await this.prisma.registration.update({
        where: { id: registrationId },
        data: { discountAppliedKobo: totalDiscount },
      });
      await this.fulfil(registrationId);
    }

    return { authorizationUrl: callbackUrl, reference };
  }

  async handlePaystackWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ) {
    if (!this.paystack.verifyWebhookSignature(rawBody, signatureHeader)) {
      this.logger.warn(
        'Rejected Paystack webhook: invalid or missing signature. Check that PAYSTACK_SECRET_KEY matches the live/test mode of the dashboard that sent this request.',
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as PaystackChargeEvent;

    if (event.event !== 'charge.success' || !event.data?.reference) {
      return { received: true };
    }

    await this.settleByReference(event.data.reference);
    return { received: true };
  }

  async verifyRegistrationPayment(registrationId: string, token?: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { order: true },
    });
    if (!registration || !matchesLookupToken(registration.lookupToken, token)) {
      throw new NotFoundException('Registration not found');
    }
    if (!registration.order) {
      throw new NotFoundException(
        'No payment has been started for this registration',
      );
    }

    if (registration.order.status === 'pending') {
      await this.settleByReference(registration.order.providerReference);
    }

    const fresh = await this.prisma.registration.findUniqueOrThrow({
      where: { id: registrationId },
    });
    return { status: fresh.status };
  }

  private async settleByReference(reference: string): Promise<void> {
    const verified = await this.paystack.verifyTransaction(reference);
    if (!verified.successful || verified.reference !== reference) {
      this.logger.warn(
        `Paystack verify failed or mismatched for reference ${reference}`,
      );
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { providerReference: reference },
    });
    if (!order) {
      this.logger.warn(`Verify for unknown reference ${reference} — no-op`);
      return;
    }

    if (verified.amountMinor < order.amountMinor) {
      await this.prisma.order.updateMany({
        where: { providerReference: reference, status: 'pending' },
        data: { status: 'amount_mismatch' },
      });
      this.logger.error(
        `Underpayment for order ${order.id}: expected ${order.amountMinor}, got ${verified.amountMinor} — held for review, no ticket issued`,
      );
      return;
    }
    const claim = await this.prisma.order.updateMany({
      where: { providerReference: reference, status: 'pending' },
      data: {
        status: 'paid',
        paidAt: new Date(),
        amountMinor: verified.amountMinor,
      },
    });

    if (claim.count === 0) {
      this.logger.log(
        `Settle for reference ${reference} already handled or unknown — no-op`,
      );
      return;
    }

    const registration = await this.prisma.registration.findUniqueOrThrow({
      where: { id: order.registrationId },
    });
    if (registration.couponId) {
      await this.coupons.redeem(registration.couponId);
    }

    await this.fulfil(order.registrationId);
  }

  // Post-payment hand-off: students go to manual ID review, everyone else
  // gets their ticket issued and emailed.
  private async fulfil(registrationId: string): Promise<void> {
    const registration = await this.prisma.registration.findUniqueOrThrow({
      where: { id: registrationId },
      include: { ticketProduct: true },
    });

    if (registration.ticketProduct.category === 'student') {
      await this.prisma.registration.update({
        where: { id: registration.id },
        data: { status: 'pending_review' },
      });
      await this.studentReviewEmailQueue.enqueue(registration.id, 'pending');
      await this.studentReviewEmailQueue.enqueueAdminNotify(registration.id);
      return;
    }

    const ticket = await this.tickets.issueTicketForRegistration(
      registration.id,
    );
    await this.emailQueue.enqueue(ticket.id);
    await this.whatsAppInviteQueue.enqueueForNewTicket(ticket.id);
  }
}
