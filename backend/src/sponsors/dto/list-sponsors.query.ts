import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Same reasoning as ListSpeakersQueryDto: sponsors/partners directory is
// manually ordered via displayOrder, so default to a larger page so
// reordering across pages stays practical.
export class ListSponsorsQueryDto {
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
