import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPaidCheckoutFixture } from '../testing/fixtures';
import { TicketsService } from '../tickets/tickets.service';
import { CheckInsService } from './check-ins.service';
import { sha256Hex } from './hash';

describe('CheckInsService offline sync (integration)', () => {
  const prisma = new PrismaService();
  const tickets = new TicketsService(prisma);
  const auditLog = new AuditLogService(prisma);
  const checkIns = new CheckInsService(prisma, auditLog);

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

  it('offline index includes a hash matching the real ticket code and qr secret', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      const index = await checkIns.getOfflineIndex();
      const entry = index.find(
        (e) => e.codeHash === sha256Hex(fixture.ticket.ticketCode),
      );
      expect(entry).toBeDefined();
      expect(entry?.qrHash).toBe(sha256Hex(fixture.ticket.qrSecret));
      expect(entry?.status).toBe('unused');
      expect(entry?.attendee.fullName).toBe('Test Attendee');
    } finally {
      await fixture.teardown();
    }
  });

  it('syncs a single queued scan as valid_first_use and records the client scan time', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      const scannedAt = new Date(Date.now() - 60_000).toISOString();
      const [result] = await checkIns.sync(
        [
          {
            clientScanId: randomUUID(),
            shortCode: fixture.ticket.ticketCode,
            stationId: 'station-A',
            scannedAt,
          },
        ],
        'door-staff-id',
      );
      expect(result.result).toBe('valid_first_use');

      const checkIn = await prisma.checkIn.findFirst({
        where: { ticketId: fixture.ticket.id },
      });
      expect(checkIn?.checkedInAt.toISOString()).toBe(scannedAt);
    } finally {
      await fixture.teardown();
    }
  });

  it('resolves two offline stations syncing the same ticket to one winner and one flagged conflict', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      const earlierScanTime = new Date(Date.now() - 120_000).toISOString();
      const laterScanTime = new Date(Date.now() - 90_000).toISOString();

      const [resultB, resultA] = await Promise.all([
        checkIns.sync(
          [
            {
              clientScanId: randomUUID(),
              shortCode: fixture.ticket.ticketCode,
              stationId: 'station-B',
              scannedAt: laterScanTime,
            },
          ],
          'door-staff-id',
        ),
        checkIns.sync(
          [
            {
              clientScanId: randomUUID(),
              shortCode: fixture.ticket.ticketCode,
              stationId: 'station-A',
              scannedAt: earlierScanTime,
            },
          ],
          'door-staff-id',
        ),
      ]);

      const results = [resultB[0], resultA[0]];
      const winners = results.filter((r) => r.result === 'valid_first_use');
      const conflicts = results.filter((r) => r.result === 'sync_conflict');
      expect(winners).toHaveLength(1);
      expect(conflicts).toHaveLength(1);

      const checkInCount = await prisma.checkIn.count({
        where: { ticketId: fixture.ticket.id },
      });
      expect(checkInCount).toBe(1);

      const conflictAudit = await prisma.auditLog.findFirst({
        where: { action: 'offline_sync_conflict', targetId: fixture.ticket.id },
      });
      expect(conflictAudit).not.toBeNull();
    } finally {
      await fixture.teardown();
    }
  });

  it('is idempotent when the same winning scan is synced twice (retry after a dropped response)', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      const clientScanId = randomUUID();
      const scannedAt = new Date().toISOString();
      const item = {
        clientScanId,
        shortCode: fixture.ticket.ticketCode,
        stationId: 'station-A',
        scannedAt,
      };

      const [first] = await checkIns.sync([item], 'door-staff-id');
      const [second] = await checkIns.sync([item], 'door-staff-id');

      expect(first.result).toBe('valid_first_use');
      expect(second.result).toBe('already_synced');

      const checkInCount = await prisma.checkIn.count({
        where: { ticketId: fixture.ticket.id },
      });
      expect(checkInCount).toBe(1);
    } finally {
      await fixture.teardown();
    }
  });

  it('retrying a losing (conflicted) scan recomputes the same conflict rather than corrupting state', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      const winnerItem = {
        clientScanId: randomUUID(),
        shortCode: fixture.ticket.ticketCode,
        stationId: 'station-A',
        scannedAt: new Date(Date.now() - 60_000).toISOString(),
      };
      const loserItem = {
        clientScanId: randomUUID(),
        shortCode: fixture.ticket.ticketCode,
        stationId: 'station-B',
        scannedAt: new Date(Date.now() - 30_000).toISOString(),
      };

      await checkIns.sync([winnerItem], 'door-staff-id');
      const [firstAttempt] = await checkIns.sync([loserItem], 'door-staff-id');
      const [retryAttempt] = await checkIns.sync([loserItem], 'door-staff-id');

      expect(firstAttempt.result).toBe('sync_conflict');
      expect(retryAttempt.result).toBe('sync_conflict');

      const checkInCount = await prisma.checkIn.count({
        where: { ticketId: fixture.ticket.id },
      });
      expect(checkInCount).toBe(1);
    } finally {
      await fixture.teardown();
    }
  });

  it('reports void tickets distinctly during sync without creating a check-in', async () => {
    const fixture = await makeIssuedTicketFixture();
    try {
      await prisma.ticket.update({
        where: { id: fixture.ticket.id },
        data: { status: 'void' },
      });

      const [result] = await checkIns.sync(
        [
          {
            clientScanId: randomUUID(),
            shortCode: fixture.ticket.ticketCode,
            stationId: 'station-A',
            scannedAt: new Date().toISOString(),
          },
        ],
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

  it('processes a mixed batch (multiple stations worth of queued scans) correctly', async () => {
    const fixtureA = await makeIssuedTicketFixture();
    const fixtureB = await makeIssuedTicketFixture();
    try {
      const results = await checkIns.sync(
        [
          {
            clientScanId: randomUUID(),
            shortCode: fixtureA.ticket.ticketCode,
            stationId: 'station-A',
            scannedAt: new Date(Date.now() - 60_000).toISOString(),
          },
          {
            clientScanId: randomUUID(),
            shortCode: fixtureB.ticket.ticketCode,
            stationId: 'station-A',
            scannedAt: new Date(Date.now() - 50_000).toISOString(),
          },
          {
            clientScanId: randomUUID(),
            shortCode: 'ZZZZZZ',
            stationId: 'station-A',
            scannedAt: new Date(Date.now() - 40_000).toISOString(),
          },
        ],
        'door-staff-id',
      );

      expect(results.map((r) => r.result)).toEqual([
        'valid_first_use',
        'valid_first_use',
        'not_found',
      ]);
    } finally {
      await fixtureA.teardown();
      await fixtureB.teardown();
    }
  });
});
