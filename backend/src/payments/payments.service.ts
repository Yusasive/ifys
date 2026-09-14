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
import { StudentReviewEmailQueue } from '../email/student-review-email.queue';
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { matchesLookupToken } from '../registrations/registrations.service';
import { TicketsService } from '../tickets/tickets.service';
import { PaystackProvider } from './paystack.provider';

function earlyBirdDiscountKobo(
  ticketProduct: {
    discountPercent: number | null;
    discountExpiresAt: Date | null;
  },
  priceKobo: number,
): number {
  if (!ticketProduct.discountPercent || !ticketProduct.discountExpiresAt) {
    return 0;
  }
  if (ticketProduct.discountExpiresAt.getTime() < Date.now()) {
    return 0;
  }
  return Math.round((priceKobo * ticketProduct.discountPercent) / 100);
}

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
  ) {}

  async createCheckout(registrationId: string, token?: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { attendee: true, ticketProduct: true, coupon: true },
    });
    if (!registration || !matchesLookupToken(registration.lookupToken, token)) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.status === 'paid') {
      throw new ConflictException(
        'This registration has already been paid for.',
      );
    }

    const basePrice = registration.ticketProduct.priceKobo;
    const earlyBirdOff = earlyBirdDiscountKobo(
      registration.ticketProduct,
      basePrice,
    );
    const priceAfterEarlyBird = basePrice - earlyBirdOff;

    let couponOff = 0;
    if (registration.couponId) {
      const coupon = await this.coupons
        .findRedeemableCoupon(registration.eventId, registration.coupon!.code)
        .catch(() => null);
      if (coupon) {
        couponOff = this.coupons.computeDiscountKobo(
          coupon,
          priceAfterEarlyBird,
        );
      }
    }

    const finalAmount = Math.max(0, priceAfterEarlyBird - couponOff);
    const totalDiscount = basePrice - finalAmount;

    const reference = `ify-${registration.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
    const callbackUrl = `${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/register/confirmation?registration=${registration.id}&token=${registration.lookupToken}`;

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
      include: { ticketProduct: true },
    });
    if (registration.couponId) {
      await this.coupons.redeem(registration.couponId);
    }

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
      order.registrationId,
    );
    await this.emailQueue.enqueue(ticket.id);
  }
}
