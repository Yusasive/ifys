import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CouponDiscountType } from '../../generated/prisma/enums';

export class CreateCouponDto {
  @IsString()
  eventSlug!: string;

  @IsString()
  @MinLength(2)
  code!: string;

  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;

  // Percent: 1-100. Fixed: kobo amount off (no upper bound — the checkout
  // clamps the final price to 0 regardless).
  @IsInt()
  @Min(1)
  @ValidateIf((o: CreateCouponDto) => o.discountType === 'percent')
  @Max(100)
  discountValue!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
