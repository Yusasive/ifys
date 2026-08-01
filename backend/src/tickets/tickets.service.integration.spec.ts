import 'dotenv/config';
import { PrismaService } from '../prisma/prisma.service';
import { createPaidCheckoutFixture } from '../testing/fixtures';
import { TicketsService } from './tickets.service';

describe('TicketsService.issueTicketForRegistration (integration)', () => {
  const prisma = new PrismaService();
  const tickets = new TicketsService(prisma);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('is idempotent when called twice sequentially', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      const first = await tickets.issueTicketForRegistration(
        fixture.registration.id,
      );
      const second = await tickets.issueTicketForRegistration(
        fixture.registration.id,
      );

      expect(second.id).toBe(first.id);
      const count = await prisma.ticket.count({
        where: { registrationId: fixture.registration.id },
      });
      expect(count).toBe(1);
    } finally {
      await fixture.teardown();
    }
  });

  // TRD §11 priority 2: concurrent/simultaneous issuance for the same
  // registration must resolve to exactly one ticket — this is the same
  // invariant a duplicate webhook delivery or two racing admin actions
  // would need to hold.
  it('resolves concurrent simultaneous calls to exactly one ticket', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      const results = await Promise.all([
        tickets.issueTicketForRegistration(fixture.registration.id),
        tickets.issueTicketForRegistration(fixture.registration.id),
        tickets.issueTicketForRegistration(fixture.registration.id),
      ]);

      const uniqueTicketIds = new Set(results.map((t) => t.id));
      expect(uniqueTicketIds.size).toBe(1);

      const count = await prisma.ticket.count({
        where: { registrationId: fixture.registration.id },
      });
      expect(count).toBe(1);
    } finally {
      await fixture.teardown();
    }
  });

  it('generates a ticket with the expected code shape and unused status', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      const ticket = await tickets.issueTicketForRegistration(
        fixture.registration.id,
      );
      expect(ticket.ticketCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(ticket.status).toBe('unused');
      expect(ticket.qrSecret.length).toBeGreaterThan(0);
    } finally {
      await fixture.teardown();
    }
  });
});
