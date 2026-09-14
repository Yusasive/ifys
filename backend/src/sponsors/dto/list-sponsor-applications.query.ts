import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.query';
import { SponsorApplicationStatus } from '../../generated/prisma/enums';

const STATUSES = ['pending', 'approved', 'rejected'] as const;

export class ListSponsorApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: SponsorApplicationStatus;
}
