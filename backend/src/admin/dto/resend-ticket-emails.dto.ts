import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { TicketEmailKind } from '../../generated/prisma/enums';

export class ResendTicketEmailsDto {
  @IsEnum(TicketEmailKind)
  kind!: TicketEmailKind;

  // Specific tickets to resend to. Left out, every ticket whose email of
  // this kind failed is resent.
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  ticketIds?: string[];
}
