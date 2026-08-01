import { randomBytes, randomInt } from 'node:crypto';

// Excludes 0/O, 1/I/L — ambiguous when read aloud at the door or handwritten
// on a printed ticket. Confirmed length/charset per event organizer sign-off.
const TICKET_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TICKET_CODE_LENGTH = 6;

export function generateTicketCode(): string {
  let code = '';
  for (let i = 0; i < TICKET_CODE_LENGTH; i++) {
    code += TICKET_CODE_ALPHABET[randomInt(TICKET_CODE_ALPHABET.length)];
  }
  return code;
}

// Opaque, high-entropy, unguessable — the QR encodes this literally. Per
// TRD §5, the security boundary is the server-side single-use DB lookup,
// not any cryptographic structure in the token itself, so a plain random
// secret is sufficient (no HMAC/JWT needed) and simpler to reason about.
export function generateQrSecret(): string {
  return randomBytes(32).toString('base64url');
}
