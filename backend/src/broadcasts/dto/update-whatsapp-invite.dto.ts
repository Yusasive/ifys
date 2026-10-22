import { IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class UpdateWhatsAppInviteDto {
  @IsString()
  eventSlug!: string;

  // The group's invite link; null turns the automatic invite email off.
  @ValidateIf((_, value) => value !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2000)
  whatsappGroupUrl!: string | null;
}
