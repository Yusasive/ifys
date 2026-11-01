import { IsString, MinLength } from 'class-validator';

export class UndoDto {
  @IsString()
  @MinLength(1)
  ticketId!: string;
}
