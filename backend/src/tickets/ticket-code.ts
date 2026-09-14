import { randomBytes, randomInt } from 'node:crypto';

const TICKET_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TICKET_CODE_LENGTH = 6;

export function generateTicketCode(): string {
  let code = '';
  for (let i = 0; i < TICKET_CODE_LENGTH; i++) {
    code += TICKET_CODE_ALPHABET[randomInt(TICKET_CODE_ALPHABET.length)];
  }
  return code;
}

export function generateQrSecret(): string {
  return randomBytes(32).toString('base64url');
}
