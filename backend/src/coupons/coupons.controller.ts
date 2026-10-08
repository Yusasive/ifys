import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from './coupons.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Controller('coupons')
export class CouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('validate')
  async validate(@Body() dto: ValidateCouponDto) {
    const event = await this.prisma.event.findUnique({
      where: { slug: dto.eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${dto.eventSlug}"`);
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

    const coupon = await this.coupons.findRedeemableCoupon(
      event.id,
      dto.code,
      dto.category,
    );
    const quote = this.coupons.quote(ticketProduct, coupon);

    return {
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      priceKobo: quote.basePriceKobo,
      earlyBirdKobo: quote.earlyBirdKobo,
      discountKobo: quote.couponKobo,
      finalPriceKobo: quote.finalPriceKobo,
    };
  }
}
