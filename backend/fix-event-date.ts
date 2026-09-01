import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/prisma/client';

const EXPECTED = new Date('2026-11-05T09:00:00+01:00');
const SLUG = 'ify-summit-2026';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const event = await prisma.event.findUnique({ where: { slug: SLUG } });
  if (!event) {
    console.log(`No event found with slug "${SLUG}" — nothing to fix.`);
    await prisma.$disconnect();
    return;
  }

  if (event.startsAt.getTime() === EXPECTED.getTime()) {
    console.log(`${event.slug} already set to ${EXPECTED.toISOString()} — no change needed.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`${event.slug} was ${event.startsAt.toISOString()}, updating to ${EXPECTED.toISOString()}...`);
  await prisma.event.update({
    where: { id: event.id },
    data: { startsAt: EXPECTED },
  });
  console.log('Done.');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
