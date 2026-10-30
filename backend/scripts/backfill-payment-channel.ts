// One-off: fills orders.payment_channel for Paystack orders paid before the
// column existed, by re-verifying each reference with Paystack.
// Run: npx ts-node scripts/backfill-payment-channel.ts
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) throw new Error('PAYSTACK_SECRET_KEY is not set');

  const orders = await prisma.order.findMany({
    where: { status: 'paid', provider: 'paystack', paymentChannel: null },
    select: { id: true, providerReference: true },
  });
  console.log(`${orders.length} paid Paystack orders to backfill`);

  let updated = 0;
  for (const o of orders) {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(o.providerReference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const body = (await res.json()) as { data?: { channel?: string } };
    const channel = body.data?.channel;
    if (!res.ok || !channel) {
      console.warn(`skip ${o.providerReference}: no channel returned`);
      continue;
    }
    await prisma.order.update({
      where: { id: o.id },
      data: { paymentChannel: channel },
    });
    updated++;
  }
  console.log(`Updated ${updated}/${orders.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
