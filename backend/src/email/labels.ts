import { Category, Tier } from '../generated/prisma/enums';

export const CATEGORY_LABELS: Record<Category, string> = {
  student: 'Student',
  founder: 'Founder / Entrepreneur',
  professional: 'Working Professional',
};

export const TIER_LABELS: Record<Tier, string> = {
  standard: 'Standard',
  premium: 'Premium',
};
