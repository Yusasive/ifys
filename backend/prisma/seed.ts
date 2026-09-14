import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

// DEV-ONLY credentials, never for production use — printed to the
// console below so a fresh `prisma db seed` is self-documenting.
const DEV_ADMIN_USERS = [
  { name: 'Dev Super Admin', email: 'superadmin@ifysummit.ng', password: 'dev-superadmin-pw', role: 'super_admin' as const },
  { name: 'Dev Organizer', email: 'organizer@ifysummit.ng', password: 'dev-organizer-pw', role: 'organizer' as const },
  { name: 'Dev Door Staff', email: 'doorstaff@ifysummit.ng', password: 'dev-doorstaff-pw', role: 'door_staff' as const },
];

const PRICING_KOBO = {
  student: { standard: 500000, premium: 500000 }, // NGN 5,000
  regular: { standard: 750000, premium: 750000 }, // NGN 7,500
  founder: { standard: 1000000, premium: 1000000 }, // NGN 10,000 (retired)
  professional: { standard: 1000000, premium: 1000000 }, // NGN 10,000
} as const;

// Sample speaker lineup for local development — no photoKey since that
// requires a real object in the configured storage bucket; the public UI
// falls back to a placeholder avatar when photoUrl is null.
const SAMPLE_SPEAKERS = [
  {
    name: 'Dr. Amina Yusuf',
    role: 'Chief Economist, Bank of Industry',
    tag: 'Keynote Speaker',
    bio: 'Dr. Amina Yusuf is a leading voice in Islamic finance policy across West Africa. Over the past 15 years she has advised central banks and multilateral institutions on structuring Shariah-compliant instruments that expand access to capital for underserved communities.\n\nShe holds a PhD in Islamic Economics from the International Islamic University Malaysia and speaks regularly at global finance forums.',
    isActive: true,
  },
  {
    name: 'Ibrahim Suleiman',
    role: 'Founder & CEO, Halal Ventures',
    tag: 'Speaker',
    bio: 'Ibrahim Suleiman builds ethical investment platforms that connect diaspora capital with high-impact ventures across Nigeria. His work sits at the intersection of fintech, faith, and inclusive growth.',
    isActive: true,
  },
  {
    name: 'Fatima Bello',
    role: 'Head of Product, TrustFund Pensions',
    tag: 'Panelist',
    bio: 'Fatima leads product strategy for Shariah-compliant retirement savings plans, helping design pension products that meet both regulatory requirements and Islamic finance principles.',
    isActive: true,
  },
  {
    name: 'Yusuf Abdulkarim',
    role: 'Youth Advocate & Entrepreneur',
    tag: 'Youth Speaker',
    bio: 'Yusuf mentors young entrepreneurs on building values-driven businesses. He is the founder of a student-led microfinance initiative that has supported over 200 small businesses in Ilorin.',
    isActive: true,
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const org = await prisma.organization.upsert({
    where: { id: 'nextif' },
    update: {},
    create: { id: 'nextif', name: 'NextIF' },
  });

  const event = await prisma.event.upsert({
    where: { slug: 'ify-summit-2026' },
    update: {},
    create: {
      orgId: org.id,
      name: 'Islamic Finance Youth Summit 2026',
      venue: 'Ilorin Innovation Hub, Multipurpose Hall',
      startsAt: new Date('2026-11-05T09:00:00+01:00'),
      slug: 'ify-summit-2026',
    },
  });

  for (const category of ['student', 'regular', 'founder', 'professional'] as const) {
    for (const tier of ['standard', 'premium'] as const) {
      const cardFields =
        tier === 'standard' && category === 'student'
          ? { cardPriceLabel: '5K', cardNote: '*30% discount for early birds' }
          : tier === 'standard' && category === 'regular'
            ? { cardPriceLabel: '7.5K', cardNote: '*30% discount for early birds' }
            : tier === 'standard' && category === 'professional'
              ? { cardPriceLabel: '10K', cardNote: '*30% discount for early birds' }
              : {};

      await prisma.ticketProduct.upsert({
        where: {
          eventId_category_tier: { eventId: event.id, category, tier },
        },
        update: {
          priceKobo: PRICING_KOBO[category][tier],
  
          isActive: category !== 'founder',
          ...cardFields,
        },
        create: {
          eventId: event.id,
          category,
          tier,
          priceKobo: PRICING_KOBO[category][tier],
          currency: 'NGN',
          perksJson: tier === 'premium' ? { placeholder: true } : {},
          isActive: category !== 'founder',
          ...cardFields,
        },
      });
    }
  }

  // Speaker has no natural unique key beyond `id`, so upsert manually by
  // (eventId, name) to keep re-running the seed idempotent.
  for (const [index, speaker] of SAMPLE_SPEAKERS.entries()) {
    const existing = await prisma.speaker.findFirst({
      where: { eventId: event.id, name: speaker.name },
    });
    const data = {
      ...speaker,
      eventId: event.id,
      displayOrder: index,
      slug: slugify(speaker.name),
    };
    if (existing) {
      await prisma.speaker.update({ where: { id: existing.id }, data });
    } else {
      await prisma.speaker.create({ data });
    }
  }

  for (const admin of DEV_ADMIN_USERS) {
    await prisma.adminUser.upsert({
      where: { email: admin.email },
      update: {},
      create: {
        name: admin.name,
        email: admin.email,
        passwordHash: await bcrypt.hash(admin.password, 10),
        role: admin.role,
      },
    });
  }

  await prisma.$disconnect();
  console.log(`Seeded event "${event.slug}" with 8 ticket products.`);
  console.log(`Seeded ${SAMPLE_SPEAKERS.length} sample speakers.`);
  console.log('Seeded dev admin users (DEV ONLY, not real credentials):');
  for (const admin of DEV_ADMIN_USERS) {
    console.log(`  ${admin.role}: ${admin.email} / ${admin.password}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
