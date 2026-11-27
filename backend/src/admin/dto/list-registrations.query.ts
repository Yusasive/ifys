import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const STATUSES = [
  'draft',
  'pending_payment',
  'paid',
  'pending_review',
  'failed',
  'refunded',
  'cancelled',
] as const;
const CATEGORIES = ['student', 'regular', 'founder', 'professional'] as const;
const TIERS = ['standard', 'premium'] as const;
const SORT_FIELDS = ['createdAt', 'fullName', 'status', 'amount'] as const;
const SORT_ORDERS = ['asc', 'desc'] as const;

export class ListRegistrationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsIn(TIERS)
  tier?: (typeof TIERS)[number];

  @IsOptional()
  @IsString()
  search?: string;

  // Registered between these two moments (inclusive).
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  source?: string;

  // Coupon code used, or "any" / "none".
  @IsOptional()
  @IsString()
  coupon?: string;

  // Payment channel of the order (card, bank_transfer, manual, free, ...).
  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortBy?: (typeof SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: (typeof SORT_ORDERS)[number];
}
