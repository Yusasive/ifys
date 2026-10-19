import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';

const CATEGORIES = ['student', 'regular', 'founder', 'professional'] as const;
const TIERS = ['standard', 'premium'] as const;
const STATUSES = [
  'draft',
  'pending_payment',
  'paid',
  'pending_review',
  'failed',
  'refunded',
  'cancelled',
] as const;

// Who a broadcast goes to. A non-empty registrationIds is an explicit
// hand-picked list and the filters are ignored; otherwise the filters
// apply, where an omitted/empty filter means "any".
export class BroadcastAudienceDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10_000)
  @IsUUID('4', { each: true })
  registrationIds?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(CATEGORIES, { each: true })
  categories?: (typeof CATEGORIES)[number][];

  @IsOptional()
  @IsArray()
  @IsIn(TIERS, { each: true })
  tiers?: (typeof TIERS)[number][];

  @IsOptional()
  @IsArray()
  @IsIn(STATUSES, { each: true })
  statuses?: (typeof STATUSES)[number][];
}
