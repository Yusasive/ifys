import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// PLACEHOLDER pricing — PRD §9: NextIF owns final pricing per category+tier
// and exact Premium perks before build sign-off. Values below unblock M1
// development only; do not treat as real prices.
const PLACEHOLDER_PRICING_KOBO = {
  student: { standard: 500000, premium: 800000 }, // NGN 5,000 / 8,000
  founder: { standard: 1500000, premium: 2500000 }, // NGN 15,000 / 25,000
  professional: { standard: 2000000, premium: 3500000 }, // NGN 20,000 / 35,000
} as const;

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
      startsAt: new Date('2026-11-07T09:00:00+01:00'),
      slug: 'ify-summit-2026',
    },
  });

  for (const category of ['student', 'founder', 'professional'] as const) {
    for (const tier of ['standard', 'premium'] as const) {
      await prisma.ticketProduct.upsert({
        where: {
          eventId_category_tier: { eventId: event.id, category, tier },
        },
        update: {},
        create: {
          eventId: event.id,
          category,
          tier,
          priceKobo: PLACEHOLDER_PRICING_KOBO[category][tier],
          currency: 'NGN',
          perksJson: tier === 'premium' ? { placeholder: true } : {},
        },
      });
    }
  }

  await prisma.$disconnect();
  console.log(`Seeded event "${event.slug}" with 6 ticket products.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
