import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export function extractSessionToken(res: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const cookie of cookies) {
    const match = /(?:^|;\s*)admin_session=([^;]+)/.exec(cookie);
    if (match) return decodeURIComponent(match[1]);
  }
  throw new Error('No admin_session cookie found in login response');
}

export async function createPaidCheckoutFixture(
  prisma: PrismaService,
  opts: { orderStatus?: 'pending' | 'paid'; providerReference?: string } = {},
) {
  const suffix = randomUUID();

  const org = await prisma.organization.create({
    data: { name: `Test Org ${suffix}` },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      name: 'Test Event',
      venue: 'Test Venue',
      startsAt: new Date('2026-11-05T09:00:00+01:00'),
      slug: `test-event-${suffix}`,
    },
  });
  const ticketProduct = await prisma.ticketProduct.create({
    data: {
      eventId: event.id,
      category: 'professional',
      tier: 'standard',
      priceKobo: 100000,
      currency: 'NGN',
    },
  });
  const attendee = await prisma.attendee.create({
    data: {
      fullName: 'Test Attendee',
      email: `test-${suffix}@example.com`,
      phone: '+2348000000000',
    },
  });
  const registration = await prisma.registration.create({
    data: {
      eventId: event.id,
      attendeeId: attendee.id,
      ticketProductId: ticketProduct.id,
      formDataJson: { role: 'Analyst', industry: 'Banking', organization: 'X' },
      status: 'pending_payment',
    },
  });
  const order = await prisma.order.create({
    data: {
      registrationId: registration.id,
      amountMinor: ticketProduct.priceKobo,
      currency: ticketProduct.currency,
      provider: 'paystack',
      providerReference: opts.providerReference ?? `test-ref-${suffix}`,
      status: opts.orderStatus ?? 'pending',
    },
  });

  async function teardown() {
    const ticket = await prisma.ticket.findUnique({
      where: { registrationId: registration.id },
    });
    if (ticket) {
      await prisma.checkIn.deleteMany({ where: { ticketId: ticket.id } });
    }
    await prisma.ticket.deleteMany({
      where: { registrationId: registration.id },
    });
    await prisma.order.deleteMany({
      where: { registrationId: registration.id },
    });
    await prisma.registration.delete({ where: { id: registration.id } });
    await prisma.attendee.delete({ where: { id: attendee.id } });
    await prisma.ticketProduct.delete({ where: { id: ticketProduct.id } });
    await prisma.event.delete({ where: { id: event.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }

  return { org, event, ticketProduct, attendee, registration, order, teardown };
}
