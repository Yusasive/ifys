import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Speakers are manually drag/order-managed via displayOrder and this list
// is typically small — default pageSize is larger than the standard 20 so
// reordering across pages stays practical for a normal-sized speaker roster.
export class ListSpeakersQueryDto {
  // Also bound separately as `@Query('event') eventSlug` on the controller
  // route — declared here too so the whitelist ValidationPipe (which
  // validates this DTO against the *whole* raw query object) doesn't
  // reject it as an unrecognized property.
  @IsOptional()
  @IsString()
  event?: string;

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
  pageSize: number = 50;
}
