import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import * as QRCode from 'qrcode';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CouponsService } from '../coupons/coupons.service';
import { CATEGORY_LABELS, TIER_LABELS } from '../email/labels';
import { generateTicketPdf } from '../email/ticket-pdf';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateTicketProductDto } from './dto/update-ticket-product.dto';
import { StudentIdUploadUrlDto } from './dto/upload-url.dto';
import {
  FormValidationError,
  validateRegistrationFormData,
} from './form-validation';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly coupons: CouponsService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  async listTicketProducts(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
      include: {
        ticketProducts: { where: { isActive: true } },
      },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    return {
      event: {
        id: event.id,
        name: event.name,
        venue: event.venue,
        startsAt: event.startsAt,
        slug: event.slug,
        ticketPurchasingPaused: event.ticketPurchasingPaused,
      },
      ticketProducts: event.ticketProducts,
    };
  }

  async createStudentIdUploadUrl(dto: StudentIdUploadUrlDto) {
    const extension = dto.fileName.split('.').pop() ?? 'bin';
    const key = `student-ids/${randomUUID()}.${extension}`;
    const uploadUrl = await this.storage.getUploadUrl(key, dto.contentType);
    return { key, uploadUrl };
  }

  // No separate draft-persistence step in M1: the wizard collects state
  // client-side across steps and this is called once, at final review
  // submission, creating the registration directly as pending_payment
  // (there is no payment step yet to gate on — see milestone.md M1).
  async createRegistration(dto: CreateRegistrationDto) {
    try {
      validateRegistrationFormData(dto.category, dto.formData);
    } catch (err) {
      if (err instanceof FormValidationError) {
        throw new BadRequestException({
          message: 'Registration form data is invalid',
          fieldErrors: err.fieldErrors,
        });
      }
      throw err;
    }

    const event = await this.prisma.event.findUnique({
      where: { slug: dto.eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${dto.eventSlug}"`);
    }
    if (event.ticketPurchasingPaused) {
      throw new BadRequestException('Ticket purchasing is not currently open');
    }

    const ticketProduct = await this.prisma.ticketProduct.findUnique({
      where: {
        eventId_category_tier: {
          eventId: event.id,
          category: dto.category,
          tier: dto.tier,
        },
      },
    });
    if (!ticketProduct || !ticketProduct.isActive) {
      throw new NotFoundException(
        `No active ${dto.tier} ticket for category ${dto.category} on this event`,
      );
    }

    // Validated here (before the registration/order even exists) so the
    // review step can surface a bad code immediately — but not redeemed
    // yet; redemptionCount only increments once payment actually succeeds
    // (see PaymentsService.handlePaystackWebhook).
    const couponId = dto.couponCode
      ? (await this.coupons.findRedeemableCoupon(event.id, dto.couponCode)).id
      : null;

    // A new Attendee row per registration — the same email can register
    // (and buy multiple tickets) more than once, so attendee identity is
    // scoped to the registration, not deduplicated globally by email.
    const attendee = await this.prisma.attendee.create({
      data: { fullName: dto.fullName, email: dto.email, phone: dto.phone },
    });

    const studentIdFileUrl =
      dto.category === 'student'
        ? (dto.formData.studentIdFileKey as string)
        : null;

    return this.prisma.registration.create({
      data: {
        eventId: event.id,
        attendeeId: attendee.id,
        ticketProductId: ticketProduct.id,
        formDataJson: dto.formData as Prisma.InputJsonValue,
        studentIdFileUrl,
        status: 'pending_payment',
        couponId,
      },
      include: { ticketProduct: true, attendee: true },
    });
  }

  async findById(id: string, token?: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { ticketProduct: true, attendee: true, ticket: true },
    });
    // Same 404 whether the id doesn't exist or the token is wrong/missing
    // — the id alone must never confirm a registration exists to someone
    // who doesn't hold its lookup token.
    if (!registration || !matchesLookupToken(registration.lookupToken, token)) {
      throw new NotFoundException('Registration not found');
    }

    // lookupToken is intentionally never echoed back once past creation.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ticket, lookupToken, ...rest } = registration;
    if (!ticket) {
      return { ...rest, ticket: null };
    }

    // Encode the same qrSecret payload the emailed ticket and the
    // check-in scanner already use (see check-ins.service's qrSecret
    // lookup) — never expose the raw secret itself to the client, only
    // the rendered image.
    const qrDataUrl = await QRCode.toDataURL(ticket.qrSecret, {
      margin: 1,
      width: 320,
    });
    return {
      ...rest,
      ticket: {
        ticketCode: ticket.ticketCode,
        status: ticket.status,
        qrDataUrl,
      },
    };
  }

  // Same auth model as findById: the lookup token is the only thing that
  // proves the caller is allowed to see this registration's ticket, so a
  // wrong/missing token gets the same 404 as a nonexistent id.
  async getTicketPdf(
    id: string,
    token: string | undefined,
  ): Promise<{ pdf: Buffer; ticketCode: string }> {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        ticketProduct: true,
        attendee: true,
        ticket: true,
        event: true,
      },
    });
    if (
      !registration ||
      !matchesLookupToken(registration.lookupToken, token) ||
      !registration.ticket
    ) {
      throw new NotFoundException('Registration not found');
    }

    const qrPngBuffer = await QRCode.toBuffer(registration.ticket.qrSecret, {
      width: 360,
      margin: 1,
    });
    const pdf = await generateTicketPdf(
      {
        fullName: registration.attendee.fullName,
        categoryLabel: CATEGORY_LABELS[registration.ticketProduct.category],
        tierLabel: TIER_LABELS[registration.ticketProduct.tier],
        eventName: registration.event.name,
        venue: registration.event.venue,
        startsAt: registration.event.startsAt,
        ticketCode: registration.ticket.ticketCode,
        ticketId: registration.ticket.id,
        supportEmail: this.config.getOrThrow<string>('SUPPORT_EMAIL'),
      },
      qrPngBuffer,
    );

    return { pdf, ticketCode: registration.ticket.ticketCode };
  }

  async listAdminTicketProducts(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    const ticketProducts = await this.prisma.ticketProduct.findMany({
      where: { eventId: event.id },
      orderBy: [{ category: 'asc' }, { tier: 'asc' }],
    });
    return { ticketProducts };
  }

  async updateTicketProduct(
    id: string,
    dto: UpdateTicketProductDto,
    actorId: string,
  ) {
    const existing = await this.prisma.ticketProduct.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Ticket product not found');
    }

    const ticketProduct = await this.prisma.ticketProduct.update({
      where: { id },
      data: {
        priceKobo: dto.priceKobo,
        discountPercent:
          dto.discountPercent === undefined ? undefined : dto.discountPercent,
        discountExpiresAt:
          dto.discountExpiresAt === undefined
            ? undefined
            : dto.discountExpiresAt === null
              ? null
              : new Date(dto.discountExpiresAt),
        cardPriceLabel:
          dto.cardPriceLabel === undefined ? undefined : dto.cardPriceLabel,
        cardNote: dto.cardNote === undefined ? undefined : dto.cardNote,
        isActive: dto.isActive,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'update_ticket_product',
      targetType: 'ticket_product',
      targetId: ticketProduct.id,
    });

    return ticketProduct;
  }
}

// Constant-time comparison so a timing side-channel can't help an
// attacker guess a valid token byte-by-byte. Also used by
// PaymentsService.createCheckout, which guards the same registration id.
export function matchesLookupToken(
  stored: string,
  provided: string | undefined,
): boolean {
  if (!provided) return false;
  const storedBuf = Buffer.from(stored);
  const providedBuf = Buffer.from(provided);
  if (storedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(storedBuf, providedBuf);
}
