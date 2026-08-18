import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.query';
import { VolunteerApplicationStatus } from '../../generated/prisma/enums';

const STATUSES = ['pending', 'approved', 'rejected'] as const;

export class ListVolunteerApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: VolunteerApplicationStatus;
}
