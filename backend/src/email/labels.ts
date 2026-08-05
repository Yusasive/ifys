import { Category, SponsorType, Tier } from '../generated/prisma/enums';

export const CATEGORY_LABELS: Record<Category, string> = {
  student: 'Student',
  founder: 'Founder / Entrepreneur',
  professional: 'Working Professional',
};

export const TIER_LABELS: Record<Tier, string> = {
  standard: 'Standard',
  premium: 'Premium',
};

export const SPONSOR_TYPE_LABELS: Record<SponsorType, string> = {
  sponsor: 'sponsor',
  partner: 'partner',
};

export const VOLUNTEER_TEAMS = [
  'programs',
  'partnerships_sponsorships',
  'marketing_communications',
  'operations_logistics',
  'design_branding',
  'photography_videography',
  'welfare_hospitality',
  'registration_ticketing',
] as const;

export type VolunteerTeam = (typeof VOLUNTEER_TEAMS)[number];

export const VOLUNTEER_TEAM_LABELS: Record<VolunteerTeam, string> = {
  programs: 'Program Team',
  partnerships_sponsorships: 'Partnership and Sponsorship Team',
  marketing_communications: 'Content, Communications and Social Media Team',
  operations_logistics: 'Logistics and Operations Team',
  design_branding: 'Design and Branding Team',
  photography_videography: 'Photography and Videography Team',
  welfare_hospitality: 'Welfare and Hospitality Team',
  registration_ticketing: 'Ticketing and Registration Team',
};
