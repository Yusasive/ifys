import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Category } from '../../generated/prisma/enums';

export class CategoryCapacityDto {
  @IsEnum(Category)
  category!: Category;

  @IsInt()
  @Min(0)
  capacity!: number;
}

export class UpdateEventSettingsDto {
  @IsOptional()
  @IsBoolean()
  ticketPurchasingPaused?: boolean;

  @IsOptional()
  @IsBoolean()
  volunteerApplicationsPaused?: boolean;

  @IsOptional()
  @IsBoolean()
  sponsorshipApplicationsPaused?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryCapacityDto)
  categoryCapacities?: CategoryCapacityDto[];
}
