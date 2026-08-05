import { IsEnum, IsString } from 'class-validator';
import { Category, Tier } from '../../generated/prisma/enums';

export class ValidateCouponDto {
  @IsString()
  eventSlug!: string;

  @IsString()
  code!: string;

  @IsEnum(Category)
  category!: Category;

  @IsEnum(Tier)
  tier!: Tier;
}
