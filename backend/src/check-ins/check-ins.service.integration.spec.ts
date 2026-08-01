import 'dotenv/config';
import { PrismaService } from '../prisma/prisma.service';
import { createPaidCheckoutFixture } from '../testing/fixtures';
import { TicketsService } from '../tickets/tickets.service';
import { CheckInsService } from './check-ins.service';

describe('CheckInsService.scan (integration)', () => {
  const prisma = new PrismaService();
  const tickets = new TicketsService(prisma);
  const checkIns = new CheckInsService(prisma);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeIssuedTicketFixture() {
    const fixture = await createPaidCheckoutFixture(prisma);
    const ticket = await tickets.issueTicketForRegistration(
      fixture.registration.id,
    );
    return { ...fixture, ticket };
  }

  it('returns not_found for an unrecognized short code', async () => {
    const result = await checkIns.scan(
      { shortCode: 'ZZZZZZ', stationId: 'station-1' },
      'door-staff-id',
    );
    expect(result.result).toBe('not_found');
  });

  it('returns valid_first_use on first scan and already_used on the next', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      const first = await checkIns.scan(
        { shortCode: fixture.ticket.ticketCode, stationId: 'station-1' },
        'door-staff-id',
      );
      expect(first.result).toBe('valid_first_use');
      if (first.result === 'valid_first_use') {
        expect(first.attendee.fullName).toBe('Test Attendee');
      }

      const second = await checkIns.scan(
        { shortCode: fixture.ticket.ticketCode, stationId: 'station-2' },
        'door-staff-id',
      );
      expect(second.result).toBe('already_used');
      if (second.result === 'already_used') {
        expect(second.firstUsedStation).toBe('station-1');
      }
    } finally {
      await fixture.teardown();
    }
  });

  it('is case-insensitive and trims whitespace on the short code', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      const result = await checkIns.scan(
        {
          shortCode: `  ${fixture.ticket.ticketCode.toLowerCase()}  `,
          stationId: 'station-1',
        },
        'door-staff-id',
      );
      expect(result.result).toBe('valid_first_use');
    } finally {
      await fixture.teardown();
    }
  });

  it('accepts a qrToken scan', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      const result = await checkIns.scan(
        { qrToken: fixture.ticket.qrSecret, stationId: 'station-1' },
        'door-staff-id',
      );
      expect(result.result).toBe('valid_first_use');
    } finally {
      await fixture.teardown();
    }
  });

  it('rejects a scan with both qrToken and shortCode', async () => {
    await expect(
      checkIns.scan(
        { qrToken: 'x', shortCode: 'y', stationId: 'station-1' },
        'door-staff-id',
      ),
    ).rejects.toThrow();
  });

  it('rejects a scan with neither qrToken nor shortCode', async () => {
    await expect(
      checkIns.scan({ stationId: 'station-1' }, 'door-staff-id'),
    ).rejects.toThrow();
  });

  it('reports a voided ticket distinctly, without consuming it as a check-in', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      await prisma.ticket.update({
        where: { id: fixture.ticket.id },
        data: { status: 'void' },
      });

      const result = await checkIns.scan(
        { shortCode: fixture.ticket.ticketCode, stationId: 'station-1' },
        'door-staff-id',
      );
      expect(result.result).toBe('void');

      const checkInCount = await prisma.checkIn.count({
        where: { ticketId: fixture.ticket.id },
      });
      expect(checkInCount).toBe(0);
    } finally {
      await fixture.teardown();
    }
  });

  // TRD §11 priority 2, re-verified at the check-in layer per M4's exit
  // criteria: two stations scanning the same code within the same second
  // must resolve to exactly one valid_first_use.
  it('resolves concurrent simultaneous scans of the same code to exactly one valid_first_use', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      const results = await Promise.all([
        checkIns.scan(
          { shortCode: fixture.ticket.ticketCode, stationId: 'station-1' },
          'door-staff-id',
        ),
        checkIns.scan(
          { shortCode: fixture.ticket.ticketCode, stationId: 'station-2' },
          'door-staff-id',
        ),
        checkIns.scan(
          { shortCode: fixture.ticket.ticketCode, stationId: 'station-3' },
          'door-staff-id',
        ),
      ]);

      const validCount = results.filter(
        (r) => r.result === 'valid_first_use',
      ).length;
      const alreadyUsedCount = results.filter(
        (r) => r.result === 'already_used',
      ).length;
      expect(validCount).toBe(1);
      expect(alreadyUsedCount).toBe(2);

      const checkInCount = await prisma.checkIn.count({
        where: { ticketId: fixture.ticket.id },
      });
      expect(checkInCount).toBe(1);
    } finally {
      await fixture.teardown();
    }
  });

  it('getStatus reports checked-in vs total ticket counts', async () => {
    const before = await checkIns.getStatus();
    const fixture = await makeIssuedTicketFixture();
    try {
      await checkIns.scan(
        { shortCode: fixture.ticket.ticketCode, stationId: 'station-1' },
        'door-staff-id',
      );
      const after = await checkIns.getStatus();
      expect(after.totalTickets).toBe(before.totalTickets + 1);
      expect(after.checkedIn).toBe(before.checkedIn + 1);
    } finally {
      await fixture.teardown();
    }
  });
});
