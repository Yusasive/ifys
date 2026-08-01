import { createHash } from 'node:crypto';

// Must match the client's SubtleCrypto SHA-256 hex digest exactly — same
// algorithm, same lowercase hex encoding, same input normalization
// (short codes uppercased/trimmed before hashing, same as the online
// scan path) — see frontend/lib/offline-index.ts.
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
