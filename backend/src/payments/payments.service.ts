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

    await this.settleByReference(event.data.reference);
    return { received: true };
  }

  // Client-triggered fallback for when the webhook never arrives (wrong
  // URL registered on Paystack's side, delivery failure, a slow/duplicate
  // retry, etc.) — the confirmation page calls this on load instead of
  // relying purely on the webhook to have already settled the order.
  // Re-verifying directly with Paystack (not trusting the client) makes
  // this safe to expose to anyone holding the registration's lookup token.
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

  // Shared by the webhook and the client-triggered fallback above — both
  // ultimately just want "go check with Paystack and settle this
  // reference if it's really paid," so there's exactly one place that
  // does the verify-then-claim dance.
  private async settleByReference(reference: string): Promise<void> {
    // The caller (webhook signature, or the registration's own lookup
    // token) only proves the request is legitimate, not that the
    // transaction really succeeded for the expected amount — so always
    // re-verify server-side before claiming the order (Paystack's
    // recommended integration pattern).
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
        `Amount mismatch for order ${order.id}: expected ${order.amountMinor}, got ${verified.amountMinor} — held for review, no ticket issued`,
      );
      return;
    }

    // Atomic claim: this UPDATE only affects a row still in `pending`
    // status. A duplicate delivery of the same webhook event, a
    // concurrently racing client-triggered verify, or both firing at
    // once — whichever loses the race finds the row already `paid` and
    // gets count 0, treated as an idempotent no-op.
    const claim = await this.prisma.order.updateMany({
      where: { providerReference: reference, status: 'pending' },
      data: { status: 'paid', paidAt: new Date() },
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
      // Only now — payment confirmed — does the coupon actually get
      // spent. An abandoned checkout never reaches this point.
      await this.coupons.redeem(registration.couponId);
    }

    const ticket = await this.tickets.issueTicketForRegistration(
      order.registrationId,
    );
    await this.emailQueue.enqueue(ticket.id);
  }
}
