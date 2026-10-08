import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CATEGORY_LABELS } from '../email/labels';
import { Coupon, TicketProduct } from '../generated/prisma/client';
import { Category, CouponDiscountType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

function assertValidDiscount(type: CouponDiscountType, value: number) {
  if (type === 'percent' && value > 100) {
    throw new BadRequestException('A percent discount cannot exceed 100%.');
  }
}

export function earlyBirdDiscountKobo(
  ticketProduct: Pick<TicketProduct, 'discountPercent' | 'discountExpiresAt'>,
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

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listAdmin(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    const coupons = await this.prisma.coupon.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'desc' },
    });
    return { coupons };
  }

  async create(dto: CreateCouponDto, actorId: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: dto.eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${dto.eventSlug}"`);
    }

    assertValidDiscount(dto.discountType, dto.discountValue);
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.coupon.findUnique({
      where: { eventId_code: { eventId: event.id, code } },
    });
    if (existing) {
      throw new BadRequestException(
        `A coupon with code "${code}" already exists for this event.`,
      );
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        eventId: event.id,
        code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxRedemptions: dto.maxRedemptions,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
        categories: dto.categories ?? [],
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'create_coupon',
      targetType: 'coupon',
      targetId: coupon.id,
    });

    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto, actorId: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }
    assertValidDiscount(
      dto.discountType ?? existing.discountType,
      dto.discountValue ?? existing.discountValue,
    );

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.prisma.coupon.findUnique({
        where: { eventId_code: { eventId: existing.eventId, code } },
      });
      if (clash) {
        throw new BadRequestException(
          `A coupon with code "${code}" already exists for this event.`,
        );
      }
    }

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxRedemptions: dto.maxRedemptions,
        expiresAt:
          dto.expiresAt === undefined
            ? undefined
            : dto.expiresAt === null
              ? null
              : new Date(dto.expiresAt),
        isActive: dto.isActive,
        categories: dto.categories,
      },
    });

    await this.auditLog.record({
      actorId,
      action: 'update_coupon',
      targetType: 'coupon',
      targetId: coupon.id,
    });

    return coupon;
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    await this.prisma.coupon.delete({ where: { id } });

    await this.auditLog.record({
      actorId,
      action: 'delete_coupon',
      targetType: 'coupon',
      targetId: id,
    });

    return { deleted: true };
  }

  async findRedeemableCoupon(
    eventId: string,
    code: string,
    category: Category,
  ): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { eventId_code: { eventId, code: code.trim().toUpperCase() } },
    });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('This coupon code is not valid.');
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This coupon code has expired.');
    }
    if (
      coupon.maxRedemptions !== null &&
      coupon.redemptionCount >= coupon.maxRedemptions
    ) {
      throw new BadRequestException(
        'This coupon code has reached its redemption limit.',
      );
    }
    if (coupon.categories.length > 0 && !coupon.categories.includes(category)) {
      const allowed = coupon.categories
        .map((c) => CATEGORY_LABELS[c])
        .join(', ');
      throw new BadRequestException(
        `This coupon code only applies to ${allowed} tickets.`,
      );
    }
    return coupon;
  }

  computeDiscountKobo(
    coupon: Pick<Coupon, 'discountType' | 'discountValue'>,
    priceKobo: number,
  ): number {
    const raw =
      coupon.discountType === 'percent'
        ? Math.round((priceKobo * coupon.discountValue) / 100)
        : coupon.discountValue;
    return Math.max(0, Math.min(raw, priceKobo));
  }

  // Single source of truth for what a registration costs — used both by
  // the public coupon preview and by checkout, so the total shown on the
  // review step is exactly what gets charged. The coupon applies on top of
  // any active early-bird price.
  quote(
    ticketProduct: Pick<
      TicketProduct,
      'priceKobo' | 'discountPercent' | 'discountExpiresAt'
    >,
    coupon: Pick<Coupon, 'discountType' | 'discountValue'> | null,
  ) {
    const basePriceKobo = ticketProduct.priceKobo;
    const earlyBirdKobo = earlyBirdDiscountKobo(ticketProduct, basePriceKobo);
    const priceAfterEarlyBird = basePriceKobo - earlyBirdKobo;
    const couponKobo = coupon
      ? this.computeDiscountKobo(coupon, priceAfterEarlyBird)
      : 0;
    const finalPriceKobo = Math.max(0, priceAfterEarlyBird - couponKobo);
    return {
      basePriceKobo,
      earlyBirdKobo,
      couponKobo,
      finalPriceKobo,
      totalDiscountKobo: basePriceKobo - finalPriceKobo,
    };
  }

  // Paid orders: the money has already moved, so the count is bumped
  // unconditionally even if that pushes it past maxRedemptions.
  async redeem(couponId: string) {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { redemptionCount: { increment: 1 } },
    });
  }

  // Free orders: atomically claim a redemption only while one is still
  // available, so concurrent 100%-off checkouts can't overshoot the limit.
  async claimRedemption(couponId: string): Promise<boolean> {
    const claimed = await this.prisma.$executeRaw`
      UPDATE "coupons"
      SET "redemption_count" = "redemption_count" + 1
      WHERE "id" = ${couponId}
        AND ("max_redemptions" IS NULL OR "redemption_count" < "max_redemptions")
    `;
    return claimed === 1;
  }
}
