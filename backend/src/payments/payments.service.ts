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
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { matchesLookupToken } from '../registrations/registrations.service';
import { TicketsService } from '../tickets/tickets.service';
import { PaystackProvider } from './paystack.provider';

// Early-bird discount is admin-managed on the ticket product itself
// (discountPercent + discountExpiresAt) and, unlike a coupon, applies
// automatically — no code needed — as long as it hasn't expired yet.
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

    // Never trust a client-supplied amount (TRD §6) — always derive it
    // server-side from the ticket product the registration was created
    // against, plus whatever discounts still validly apply at this
    // moment (early-bird may have expired, or a coupon may have been
    // deactivated, since the registration was created).
    const basePrice = registration.ticketProduct.priceKobo;
    const earlyBirdOff = earlyBirdDiscountKobo(
      registration.ticketProduct,
      basePrice,
    );
    const priceAfterEarlyBird = basePrice - earlyBirdOff;

    let couponOff = 0;
    if (registration.couponId) {
      // Re-validate rather than trusting the snapshot from registration
      // time — the coupon could have expired, been deactivated, or hit
      // its redemption cap in the meantime. If so, it silently just
      // doesn't apply rather than blocking checkout.
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

    // Order.registrationId is unique — at most one order per registration
    // ever. Re-checkout (abandoned payment, retry) regenerates the
    // provider reference on the same row rather than creating a new one.
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

    const reference = event.data.reference;

    // The webhook signature only proves the request came from Paystack,
    // not that the transaction really succeeded for the expected amount —
    // so re-verify server-side before claiming the order (Paystack's
    // recommended integration pattern).
    const verified = await this.paystack.verifyTransaction(reference);
    if (!verified.successful || verified.reference !== reference) {
      this.logger.warn(
        `Paystack verify failed or mismatched for reference ${reference}`,
      );
      return { received: true };
    }

    const order = await this.prisma.order.findUnique({
      where: { providerReference: reference },
    });
    if (!order) {
      this.logger.warn(`Webhook for unknown reference ${reference} — no-op`);
      return { received: true };
    }

    // Checked before the order is claimed as paid — a mismatched amount
    // must never reach the ticket-issuing code path below, no matter how
    // it happened (a discount-calc bug, a downgraded/tampered Paystack
    // transaction, a stale reference reused for a cheaper item).
    if (verified.amountMinor !== order.amountMinor) {
      await this.prisma.order.updateMany({
        where: { providerReference: reference, status: 'pending' },
        data: { status: 'amount_mismatch' },
      });
      this.logger.error(
        `Webhook amount mismatch for order ${order.id}: expected ${order.amountMinor}, got ${verified.amountMinor} — held for review, no ticket issued`,
      );
      return { received: true };
    }

    // Atomic claim: this UPDATE only affects a row still in `pending`
    // status. A duplicate delivery of the same webhook event — or a
    // second one racing it concurrently — will find the row already
    // `paid` and get count 0, which is treated as an idempotent no-op.
    // This is the DB-level state transition itself, not app-level locking
    // around it.
    const claim = await this.prisma.order.updateMany({
      where: { providerReference: reference, status: 'pending' },
      data: { status: 'paid', paidAt: new Date() },
    });

    if (claim.count === 0) {
      this.logger.log(
        `Webhook for reference ${reference} already handled or unknown — no-op`,
      );
      return { received: true };
    }

    const registration = await this.prisma.registration.findUniqueOrThrow({
      where: { id: order.registrationId },
    });
    if (registration.couponId) {
      // Only now — payment confirmed — does the coupon actually get
      // spent. An abandoned checkout never reaches this point.
      await this.coupons.redeem(registration.couponId);
    }

    const ticket = await this.tickets.issueTicketForRegistration(
      order.registrationId,
    );
    await this.emailQueue.enqueue(ticket.id);

    return { received: true };
  }
}
