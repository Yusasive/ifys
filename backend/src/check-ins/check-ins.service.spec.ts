import { CheckInsService } from './check-ins.service';
import type { AuditLogService } from '../audit-log/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';

const ticket = {
  id: 't1',
  status: 'unused',
  issuedAt: new Date('2026-01-01'),
  registration: {
    attendee: { fullName: 'Ada' },
    ticketProduct: { category: 'regular', tier: 'standard' },
    formDataJson: { role: 'Engineer', organization: 'Acme' },
  },
};

function build(opts: { claimCount?: number; createFails?: boolean } = {}) {
  const tx = {
    ticket: {
      updateMany: jest.fn().mockResolvedValue({ count: opts.claimCount ?? 1 }),
    },
    checkIn: {
      create: opts.createFails
        ? jest.fn().mockRejectedValue(new Error('insert failed'))
        : jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    ticket: {
      findUnique: jest.fn().mockResolvedValue(ticket),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    checkIn: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({}),
    },
    // Runs the callback like Prisma does and propagates its rejection, which
    // is what rolls the claim back in a real transaction.
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: typeof tx) => Promise<unknown>)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
  const audit = { record: jest.fn() };
  const service = new CheckInsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditLogService,
  );
  return { service, prisma, tx, audit };
}

describe('CheckInsService', () => {
  it('claims the ticket and records the check-in in one transaction', async () => {
    const { service, prisma, tx } = build();
    const res = await service.scan({ qrToken: 'q', stationId: 's1' }, 'u1');
    expect(res.result).toBe('valid_first_use');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.checkIn.create).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed check-in insert instead of reporting success', async () => {
    const { service } = build({ createFails: true });
    await expect(
      service.scan({ qrToken: 'q', stationId: 's1' }, 'u1'),
    ).rejects.toThrow('insert failed');
  });

  it('reports already_used when the claim loses the race', async () => {
    const { service, tx } = build({ claimCount: 0 });
    const res = await service.scan({ shortCode: 'abc', stationId: 's1' }, 'u1');
    expect(res.result).toBe('already_used');
    expect(tx.checkIn.create).not.toHaveBeenCalled();
  });

  it('gives a malformed queued scan its own invalid result without failing the batch', async () => {
    const { service } = build();
    const results = await service.sync(
      [
        {
          clientScanId: 'bad',
          stationId: 's1',
          scannedAt: '2026-01-01T10:00:00Z',
        },
        {
          clientScanId: 'good',
          qrToken: 'q',
          stationId: 's1',
          scannedAt: '2026-01-01T10:00:00Z',
        },
      ],
      'u1',
    );
    expect(results.map((r) => [r.clientScanId, r.result])).toEqual([
      ['bad', 'invalid'],
      ['good', 'valid_first_use'],
    ]);
  });

  it('treats a unique-violation on clientScanId as already_synced', async () => {
    const { service, prisma } = build();
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
    const [res] = await service.sync(
      [
        {
          clientScanId: 'c1',
          qrToken: 'q',
          stationId: 's1',
          scannedAt: '2026-01-01T10:00:00Z',
        },
      ],
      'u1',
    );
    expect(res.result).toBe('already_synced');
  });

  it('checks a guest in by ticket id (name search flow)', async () => {
    const { service, prisma } = build();
    const res = await service.scan({ ticketId: 't1', stationId: 's1' }, 'u1');
    expect(res.result).toBe('valid_first_use');
    expect(prisma.ticket.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' } }),
    );
  });

  it('rejects ambiguous lookups', async () => {
    const { service } = build();
    await expect(
      service.scan({ qrToken: 'q', ticketId: 't1', stationId: 's1' }, 'u1'),
    ).rejects.toThrow('exactly one');
  });

  it('refuses searches shorter than 3 characters', async () => {
    const { service } = build();
    await expect(service.search('ab')).rejects.toThrow('at least 3');
  });

  it('masks emails in search results', async () => {
    const { service, prisma } = build();
    prisma.ticket.findMany.mockResolvedValueOnce([
      {
        ...ticket,
        registration: {
          ...ticket.registration,
          attendee: { fullName: 'Ada', email: 'ada.lovelace@example.com' },
        },
      },
    ]);
    const [hit] = await service.search('ada');
    expect(hit.maskedEmail).toBe('ad***@example.com');
  });

  it('undoes a recent check-in and audits it', async () => {
    const { service, prisma, audit } = build();
    prisma.checkIn.findFirst.mockResolvedValueOnce({
      id: 'c1',
      stationId: 's1',
      checkedInBy: 'u9',
      checkedInAt: new Date(),
    });
    await service.undo('t1', 'u1');
    expect(prisma.checkIn.delete).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'undo_check_in' }),
    );
  });

  it('refuses to undo an old check-in', async () => {
    const { service, prisma } = build();
    prisma.checkIn.findFirst.mockResolvedValueOnce({
      id: 'c1',
      stationId: 's1',
      checkedInBy: 'u9',
      checkedInAt: new Date(Date.now() - 10 * 60_000),
    });
    await expect(service.undo('t1', 'u1')).rejects.toThrow('Too long ago');
    expect(prisma.checkIn.delete).not.toHaveBeenCalled();
  });

  it('counts per category/tier and leaves void tickets out', async () => {
    const { service, prisma } = build();
    const row = (status: string, category: string, tier: string) => ({
      status,
      registration: { ticketProduct: { category, tier } },
    });
    prisma.ticket.findMany.mockResolvedValueOnce([
      row('used', 'regular', 'standard'),
      row('unused', 'regular', 'standard'),
      row('unused', 'student', 'standard'),
    ]);
    const status = await service.getStatus();
    expect(status.totalTickets).toBe(3);
    expect(status.checkedIn).toBe(1);
    expect(status.groups).toEqual([
      { category: 'regular', tier: 'standard', checkedIn: 1, total: 2 },
      { category: 'student', tier: 'standard', checkedIn: 0, total: 1 },
    ]);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { not: 'void' } } }),
    );
  });

  it("returns the title and organisation printed on the guest's name tag", async () => {
    const { service } = build();
    const res = await service.scan({ qrToken: 'q', stationId: 's1' }, 'u1');
    expect(res).toMatchObject({
      result: 'valid_first_use',
      attendee: { fullName: 'Ada', title: 'Engineer', organization: 'Acme' },
    });
  });
});
