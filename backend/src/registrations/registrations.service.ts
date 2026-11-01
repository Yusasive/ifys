import { ErrorCode } from '../common/error-codes';
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
import {
  PENDING_PAYMENT_REMINDER_DELAY_MS,
  RegistrationReminderEmailQueue,
} from '../email/registration-reminder-email.queue';
import { generateTicketPdf } from '../email/ticket-pdf';
import {
  countTicketsSold,
  getCategoryAvailability,
} from './category-availability';
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
    private readonly reminderQueue: RegistrationReminderEmailQueue,
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
    const categoryAvailability = await getCategoryAvailability(
      this.prisma,
      event.id,
    );
    const ticketCapacity = categoryAvailability.reduce(
      (sum, c) => sum + c.capacity,
      0,
    );
    const ticketsSoldCount = categoryAvailability.reduce(
      (sum, c) => sum + c.soldCount,
      0,
    );
    return {
      event: {
        id: event.id,
        name: event.name,
        venue: event.venue,
        startsAt: event.startsAt,
        slug: event.slug,
        ticketPurchasingPaused: event.ticketPurchasingPaused,
        ticketCapacity,
        ticketsSoldCount,
        soldOut: categoryAvailability.every((c) => c.soldOut),
        categoryAvailability,
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

  async createRegistration(dto: CreateRegistrationDto) {
    try {
      validateRegistrationFormData(dto.category, dto.formData);
    } catch (err) {
      if (err instanceof FormValidationError) {
        throw new BadRequestException({
          code: ErrorCode.FormInvalid,
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
      throw new BadRequestException({
        code: ErrorCode.PurchasingPaused,
        message: 'Ticket purchasing is not currently open',
      });
    }
    const categoryCapacity = await this.prisma.categoryCapacity.findUnique({
      where: {
        eventId_category: { eventId: event.id, category: dto.category },
      },
    });
    const ticketsSoldCount = await countTicketsSold(
      this.prisma,
      event.id,
      dto.category,
    );
    if (!categoryCapacity || ticketsSoldCount >= categoryCapacity.capacity) {
      throw new BadRequestException({
        code: ErrorCode.SoldOut,
        message: `All ${CATEGORY_LABELS[dto.category]} tickets have been sold`,
      });
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

    const couponId = dto.couponCode
      ? (
          await this.coupons.findRedeemableCoupon(
            event.id,
            dto.couponCode,
            dto.category,
          )
        ).id
      : null;

    const attendee = await this.prisma.attendee.create({
      data: { fullName: dto.fullName, email: dto.email, phone: dto.phone },
    });

    const studentIdFileUrl =
      dto.category === 'student'
        ? (dto.formData.studentIdFileKey as string)
        : null;

    const registration = await this.prisma.registration.create({
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

    await this.reminderQueue.enqueue(registration.id, {
      delayMs: PENDING_PAYMENT_REMINDER_DELAY_MS,
    });

    return registration;
  }

  async findById(id: string, token?: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { ticketProduct: true, attendee: true, ticket: true },
    });

    if (!registration || !matchesLookupToken(registration.lookupToken, token)) {
      throw new NotFoundException('Registration not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ticket, lookupToken, ...rest } = registration;
    if (!ticket) {
      return { ...rest, ticket: null };
    }

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
