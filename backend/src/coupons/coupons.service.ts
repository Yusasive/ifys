import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Coupon } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

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

  async findRedeemableCoupon(eventId: string, code: string): Promise<Coupon> {
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

  async redeem(couponId: string) {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { redemptionCount: { increment: 1 } },
    });
  }
}
