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

    const { authorizationUrl } = await this.paystack.initializeTransaction({
      email: registration.attendee.email,
      amountKobo: registration.ticketProduct.priceKobo,
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
        amountKobo: registration.ticketProduct.priceKobo,
        currency: registration.ticketProduct.currency,
      },
      create: {
        registrationId: registration.id,
        amountKobo: registration.ticketProduct.priceKobo,
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
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as PaystackChargeEvent;

    if (event.event !== 'charge.success' || !event.data?.reference) {
      return { received: true };
    }

    const reference = event.data.reference;

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

    if (
      event.data.amount !== undefined &&
      event.data.amount !== order.amountKobo
    ) {
      this.logger.warn(
        `Webhook amount mismatch for order ${order.id}: expected ${order.amountKobo}, got ${event.data.amount}`,
      );
    }

    const ticket = await this.tickets.issueTicketForRegistration(
      order.registrationId,
    );
    await this.emailQueue.enqueue(ticket.id);

    return { received: true };
  }
}
