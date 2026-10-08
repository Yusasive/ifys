import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Category, CouponDiscountType } from '../../generated/prisma/enums';

export class CreateCouponDto {
  @IsString()
  eventSlug!: string;

  @IsString()
  @MinLength(2)
  code!: string;

  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;

  // Percent: 1-100 (checked in CouponsService, since the cap depends on
  // discountType). Fixed: kobo amount off.
  @IsInt()
  @Min(1)
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

  // Empty or omitted = valid for every category.
  @IsOptional()
  @IsArray()
  @IsEnum(Category, { each: true })
  categories?: Category[];
}
