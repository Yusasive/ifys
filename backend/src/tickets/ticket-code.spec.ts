import {
  generateQrSecret,
  generateTicketCode,
  TICKET_CODE_LENGTH,
} from './ticket-code';

const AMBIGUOUS_CHARS = ['0', 'O', '1', 'I', 'L'];

describe('generateTicketCode', () => {
  it('generates a code of the configured length', () => {
    expect(generateTicketCode()).toHaveLength(TICKET_CODE_LENGTH);
  });

  it('never includes ambiguous characters', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateTicketCode();
      for (const char of AMBIGUOUS_CHARS) {
        expect(code).not.toContain(char);
      }
    }
  });

  it('only uses uppercase letters and digits', () => {
    const code = generateTicketCode();
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it('produces distinct codes across many calls', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateTicketCode));

    expect(codes.size).toBeGreaterThan(990);
  });
});

describe('generateQrSecret', () => {
  it('generates a URL-safe opaque token with high entropy', () => {
    const secret = generateQrSecret();
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces distinct secrets across many calls', () => {
    const secrets = new Set(Array.from({ length: 1000 }, generateQrSecret));
    expect(secrets.size).toBe(1000);
  });
});
