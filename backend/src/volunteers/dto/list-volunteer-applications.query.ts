import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.query';
import { VolunteerApplicationStatus } from '../../generated/prisma/enums';

const STATUSES = ['pending', 'approved', 'rejected'] as const;

export class ListVolunteerApplicationsQueryDto extends PaginationQueryDto {
  // Also bound separately as `@Query('event') eventSlug` on the controller
  // route — declared here too so the whitelist ValidationPipe (which
  // validates this DTO against the *whole* raw query object) doesn't
  // reject it as an unrecognized property.
  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: VolunteerApplicationStatus;
}
