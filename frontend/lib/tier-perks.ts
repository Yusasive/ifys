import type { Tier } from "./api";

// Placeholder perk copy — actual Premium perks and tier differentiation
// are pending NextIF sign-off (see backend/prisma/seed.ts's placeholder
// pricing/perksJson comment). Update once real content is confirmed.
export const STANDARD_PERKS = [
  "Full-day access to all sessions",
  "Digital e-ticket with QR check-in",
  "Access to networking breaks",
];

export const PREMIUM_PERKS = [
  "Everything in Standard",
  "Reserved front-section seating",
  "Priority check-in lane",
  "Invite to the post-event mixer",
];

export function tierPerks(tier: Tier): string[] {
  return tier === "premium" ? PREMIUM_PERKS : STANDARD_PERKS;
}
