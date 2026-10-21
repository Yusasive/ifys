import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module';
import { EmailService } from '../email/email.service';
import { TicketEmailQueue } from '../email/ticket-email.queue';
import { PrismaService } from '../prisma/prisma.service';
import { extractSessionToken } from '../testing/fixtures';

interface DeliveriesBody {
  total: number;
  summary: Record<string, number>;
  rows: { ticketId: string; status: string; error: string | null }[];
}

describe('Ticket email deliveries (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;
  let sendSpy: jest.SpyInstance;
  let superAdminToken: string;
  let organizerToken: string;
  let doorStaffToken: string;

  let eventId: string;
  let eventSlug: string;
  const ticketIds: Record<string, string> = {};
  const emails: Record<string, string> = {};
  const attendeeIds: string[] = [];
  const suffix = randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as App;
    prisma = app.get(PrismaService);

    // Never hit real SMTP from tests.
    sendSpy = jest
      .spyOn(app.get(EmailService), 'sendTicketEmail')
      .mockResolvedValue(undefined);

    const login = async (email: string, password: string) =>
      extractSessionToken(
        await request(httpServer).post('/auth/login').send({ email, password }),
      );
    superAdminToken = await login(
      'superadmin@ifysummit.ng',
      'dev-superadmin-pw',
    );
    organizerToken = await login('organizer@ifysummit.ng', 'dev-organizer-pw');
    doorStaffToken = await login('doorstaff@ifysummit.ng', 'dev-doorstaff-pw');

    const org = await prisma.organization.create({
      data: { name: `Delivery Org ${suffix}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: 'Delivery Test Event',
        venue: 'Test Venue',
        startsAt: new Date('2026-11-05T09:00:00+01:00'),
        slug: `delivery-test-${suffix}`,
      },
    });
    eventId = event.id;
    eventSlug = event.slug;
    const product = await prisma.ticketProduct.create({
      data: {
        eventId,
        category: 'professional',
        tier: 'standard',
        priceKobo: 1,
      },
    });

    for (const key of ['sent', 'failed', 'untracked', 'voided']) {
      emails[key] = `${key}-${suffix}@example.com`;
      const attendee = await prisma.attendee.create({
        data: {
          fullName: `${key} Person`,
          email: emails[key],
          phone: '+2348000000000',
        },
      });
      attendeeIds.push(attendee.id);
      const registration = await prisma.registration.create({
        data: {
          eventId,
          attendeeId: attendee.id,
          ticketProductId: product.id,
          formDataJson: {},
          status: 'paid',
        },
      });
      const ticket = await prisma.ticket.create({
        data: {
          registrationId: registration.id,
          ticketCode: `T-${randomUUID()}`,
          qrSecret: randomUUID(),
          status: key === 'voided' ? 'void' : 'unused',
        },
      });
      ticketIds[key] = ticket.id;
    }

    await prisma.ticketEmailDelivery.createMany({
      data: [
        {
          ticketId: ticketIds.sent,
          kind: 'ticket',
          status: 'sent',
          sentAt: new Date(),
        },
        {
          ticketId: ticketIds.failed,
          kind: 'ticket',
          status: 'failed',
          error: '554 Rejected by Zoho',
        },
      ],
    });
  }, 30000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: Object.values(ticketIds) } },
    });
    await prisma.ticket.deleteMany({
      where: { id: { in: Object.values(ticketIds) } },
    });
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.attendee.deleteMany({ where: { id: { in: attendeeIds } } });
    await prisma.ticketProduct.deleteMany({ where: { eventId } });
    const event = await prisma.event.delete({ where: { id: eventId } });
    await prisma.organization.delete({ where: { id: event.orgId } });
    await app.close();
  }, 60000);

  function getDeliveries(kind: string, token = organizerToken) {
    return request(httpServer)
      .get(`/admin/tickets/email-deliveries?event=${eventSlug}&kind=${kind}`)
      .set('Authorization', `Bearer ${token}`);
  }

  function resend(body: object, token = organizerToken) {
    return request(httpServer)
      .post(`/admin/tickets/email-deliveries/resend?event=${eventSlug}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  async function waitForStatus(
    ticketId: string,
    kind: 'ticket' | 'date_update',
    status: string,
  ) {
    for (let i = 0; i < 120; i++) {
      const row = await prisma.ticketEmailDelivery.findUnique({
        where: { ticketId_kind: { ticketId, kind } },
      });
      if (row?.status === status) return row;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Ticket ${ticketId} never reached ${kind}=${status}`);
  }

  it('forbids door staff', async () => {
    const res = await getDeliveries('ticket', doorStaffToken);
    expect(res.status).toBe(403);
  });

  it('reports each valid ticket with its delivery status', async () => {
    const res = await getDeliveries('ticket');
    expect(res.status).toBe(200);
    const body = res.body as DeliveriesBody;
    expect(body.total).toBe(3);
    expect(body.summary).toMatchObject({ sent: 1, failed: 1, untracked: 1 });
    const failed = body.rows.find((r) => r.ticketId === ticketIds.failed);
    expect(failed).toMatchObject({
      status: 'failed',
      error: '554 Rejected by Zoho',
    });
    expect(body.rows.some((r) => r.ticketId === ticketIds.voided)).toBe(false);

    const dateUpdate = await getDeliveries('date_update');
    expect((dateUpdate.body as DeliveriesBody).summary.not_sent).toBe(3);
  });

  it('resends the ticket only to people whose email failed', async () => {
    sendSpy.mockClear();
    const res = await resend({ kind: 'ticket' });
    expect(res.status).toBe(201);
    expect((res.body as { queued: number }).queued).toBe(1);

    const row = await waitForStatus(ticketIds.failed, 'ticket', 'sent');
    expect(row.error).toBeNull();
    expect(sendSpy.mock.calls.map(([to]) => to as string)).toEqual([
      emails.failed,
    ]);

    const again = await resend({ kind: 'ticket' });
    expect(again.status).toBe(400);
  }, 60000);

  it('keeps the new-date resend for super admins', async () => {
    const forbidden = await resend({
      kind: 'date_update',
      ticketIds: [ticketIds.sent],
    });
    expect(forbidden.status).toBe(403);

    const res = await resend(
      { kind: 'date_update', ticketIds: [ticketIds.sent] },
      superAdminToken,
    );
    expect(res.status).toBe(201);
    await waitForStatus(ticketIds.sent, 'date_update', 'sent');

    const body = (await getDeliveries('date_update')).body as DeliveriesBody;
    expect(body.summary).toMatchObject({ sent: 1, not_sent: 2 });
  }, 60000);

  it('marks a ticket email failed once it runs out of retries', async () => {
    sendSpy.mockRejectedValueOnce(new Error('421 Too many messages'));

    // A single attempt, so the failure is final without waiting on backoff.
    // Bracket access reaches the private queue.
    const queue = app.get(TicketEmailQueue)['queue'];
    await queue.add(
      'send',
      { ticketId: ticketIds.untracked, variant: 'resent' },
      { attempts: 1 },
    );

    const row = await waitForStatus(ticketIds.untracked, 'ticket', 'failed');
    expect(row.error).toBe('421 Too many messages');
  }, 60000);

  it('rebuilds a missing status from the jobs Redis still holds', async () => {
    // As if that failure had happened before tracking existed.
    await prisma.ticketEmailDelivery.delete({
      where: {
        ticketId_kind: { ticketId: ticketIds.untracked, kind: 'ticket' },
      },
    });

    const ticketQueue = app.get(TicketEmailQueue);
    await ticketQueue['backfillDeliveries']();

    const row = await prisma.ticketEmailDelivery.findUniqueOrThrow({
      where: {
        ticketId_kind: { ticketId: ticketIds.untracked, kind: 'ticket' },
      },
    });
    expect(row).toMatchObject({
      status: 'failed',
      error: '421 Too many messages',
    });
  });
});
