import { Transform } from 'class-transformer';

// Email is the identity key for login (AdminUser.email is @unique) but
// Postgres string comparisons are case-sensitive by default — without
// this, an account created as "Jane@Example.com" can't log in typing
// "jane@example.com", even with the exact right password. Trims +
// lowercases on every DTO that writes or looks up an AdminUser by email,
// so everything stored/queried from here on is canonical.
export function NormalizeEmail() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
}
