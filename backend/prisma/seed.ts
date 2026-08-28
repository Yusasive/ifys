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

// Launch pricing: Student 5k, Regular 7.5k, Professional/Founders/
// Entrepreneurs 10k. `founder` is kept only so the seed can still deactivate
// it below — its rows exist purely for historical registrations to resolve
// against and are never active/selectable.
const PRICING_KOBO = {
  student: { standard: 500000, premium: 500000 }, // NGN 5,000
  regular: { standard: 750000, premium: 750000 }, // NGN 7,500
  founder: { standard: 1000000, premium: 1000000 }, // NGN 10,000 (retired)
  professional: { standard: 1000000, premium: 1000000 }, // NGN 10,000
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
          // `founder` is retired — never (re-)activated by the seed, even
          // on re-run. Every other category is active.
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
  console.log('Seeded dev admin users (DEV ONLY, not real credentials):');
  for (const admin of DEV_ADMIN_USERS) {
    console.log(`  ${admin.role}: ${admin.email} / ${admin.password}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
