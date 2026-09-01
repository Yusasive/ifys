import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/prisma/client';

const EXPECTED = new Date('2026-11-05T09:00:00+01:00');

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const events = await prisma.event.findMany({
    select: { id: true, slug: true, name: true, startsAt: true },
  });

  if (events.length === 0) {
    console.log('No events found in this database.');
  }

  for (const e of events) {
    const matches = e.startsAt.getTime() === EXPECTED.getTime();
    console.log(
      `${e.slug} (${e.name}) — startsAt: ${e.startsAt.toISOString()} — ${matches ? 'OK (Nov 5)' : 'STALE, needs update'}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
