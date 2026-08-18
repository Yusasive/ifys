import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Speakers are manually drag/order-managed via displayOrder and this list
// is typically small — default pageSize is larger than the standard 20 so
// reordering across pages stays practical for a normal-sized speaker roster.
export class ListSpeakersQueryDto {
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
