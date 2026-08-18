import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.query';
import { SponsorApplicationStatus } from '../../generated/prisma/enums';

const STATUSES = ['pending', 'approved', 'rejected'] as const;

export class ListSponsorApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: SponsorApplicationStatus;
}
