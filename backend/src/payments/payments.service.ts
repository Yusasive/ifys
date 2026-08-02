import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { FlutterwaveProvider } from './flutterwave.provider';

interface FlutterwaveChargeEvent {
  event: string;
  data?: {
    id?: number | string;
    tx_ref?: string;
    status?: string;
    amount?: number;
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly flutterwave: FlutterwaveProvider,
    private readonly tickets: TicketsService,
    private readonly emailQueue: TicketEmailQueue,
  ) {}

  async createCheckout(registrationId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: { attendee: true, ticketProduct: true },
    });
    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    if (registration.status === 'paid') {
      throw new ConflictException(
        'This registration has already been paid for.',
      );
    }

    // Never trust a client-supplied amount (TRD §6) — always derive it
    // server-side from the ticket product the registration was created
    // against.
    const reference = `ify-${registration.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
    const callbackUrl = `${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/register/confirmation?registration=${registration.id}`;

    const { authorizationUrl } = await this.flutterwave.initializeTransaction({
      email: registration.attendee.email,
      amountMinor: registration.ticketProduct.priceKobo,
      reference,
      callbackUrl,
    });

    // Order.registrationId is unique — at most one order per registration
    // ever. Re-checkout (abandoned payment, retry) regenerates the
    // provider reference on the same row rather than creating a new one.
    await this.prisma.order.upsert({
      where: { registrationId: registration.id },
      update: {
        providerReference: reference,
        status: 'pending',
        amountMinor: registration.ticketProduct.priceKobo,
        currency: registration.ticketProduct.currency,
      },
      create: {
        registrationId: registration.id,
        amountMinor: registration.ticketProduct.priceKobo,
        currency: registration.ticketProduct.currency,
        provider: 'flutterwave',
        providerReference: reference,
        status: 'pending',
      },
    });

    return { authorizationUrl, reference };
  }

  async handleFlutterwaveWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ) {
    if (!this.flutterwave.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(
      rawBody.toString('utf8'),
    ) as FlutterwaveChargeEvent;

    if (
      event.event !== 'charge.completed' ||
      event.data?.status !== 'successful' ||
      !event.data?.tx_ref ||
      event.data?.id === undefined
    ) {
      return { received: true };
    }

    const reference = event.data.tx_ref;

    // The webhook hash only proves the request came from Flutterwave, not
    // that the transaction really succeeded for the expected amount — so
    // re-verify server-side before claiming the order (Flutterwave's
    // recommended integration pattern).
    const verified = await this.flutterwave.verifyTransaction(
      String(event.data.id),
    );
    if (!verified.successful || verified.reference !== reference) {
      this.logger.warn(
        `Flutterwave verify failed or mismatched for reference ${reference}`,
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

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { providerReference: reference },
    });

    if (verified.amountMinor !== order.amountMinor) {
      this.logger.warn(
        `Webhook amount mismatch for order ${order.id}: expected ${order.amountMinor}, got ${verified.amountMinor}`,
      );
    }

    const ticket = await this.tickets.issueTicketForRegistration(
      order.registrationId,
    );
    await this.emailQueue.enqueue(ticket.id);

    return { received: true };
  }
}
