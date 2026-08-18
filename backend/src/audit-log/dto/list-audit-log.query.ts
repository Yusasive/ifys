import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.query';

export class ListAuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  action?: string;

  // Only honoured by the system-wide listing (GET /admin/audit-log). The
  // "my activity" listing (GET /admin/audit-log/me) always scopes to the
  // authenticated caller and ignores this field entirely — see
  // AuditLogService#listForActor.
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
