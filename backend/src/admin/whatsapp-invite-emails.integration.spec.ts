import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { extractSessionToken } from '../testing/fixtures';
import { AdminService } from './admin.service';

interface DeliveriesBody {
  total: number;
  summary: Record<string, number>;
  rows: { ticketId: string; status: string }[];
}

const GROUP_URL = 'https://chat.whatsapp.com/test-group';

describe('WhatsApp invite emails (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;
  let broadcastSpy: jest.SpyInstance;
  let organizerToken: string;

  let eventId: string;
  let eventSlug: string;
  let productId: string;
  const ticketIds: Record<string, string> = {};
  const emails: Record<string, string> = {};
  const attendeeIds: string[] = [];
  const suffix = randomUUID();

  async function createRegistration(
    key: string,
    status: 'paid' | 'pending_payment',
  ) {
    emails[key] = `${key}-${suffix}@example.com`;
    const attendee = await prisma.attendee.create({
      data: {
        fullName: `${key} Person`,
        email: emails[key],
        phone: '+2348000000000',
      },
    });
    attendeeIds.push(attendee.id);
    return prisma.registration.create({
      data: {
        eventId,
        attendeeId: attendee.id,
        ticketProductId: productId,
        formDataJson: {},
        status,
      },
    });
  }

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
    jest
      .spyOn(app.get(EmailService), 'sendTicketEmail')
      .mockResolvedValue(undefined);
    broadcastSpy = jest
      .spyOn(app.get(EmailService), 'sendBroadcastEmail')
      .mockResolvedValue(undefined);

    organizerToken = extractSessionToken(
      await request(httpServer).post('/auth/login').send({
        email: 'organizer@ifysummit.ng',
        password: 'dev-organizer-pw',
      }),
    );

    const org = await prisma.organization.create({
      data: { name: `WhatsApp Org ${suffix}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: 'WhatsApp Test Event',
        venue: 'Test Venue',
        startsAt: new Date('2026-11-05T09:00:00+01:00'),
        slug: `whatsapp-test-${suffix}`,
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
    productId = product.id;

    // "reached" and "bounced" had tickets when a hand-sent WhatsApp
    // broadcast went out; it still failed for "bounced". "later" registered
    // after it.
    const issuedAt = new Date(Date.now() - 60 * 60 * 1000);
    for (const key of ['reached', 'bounced', 'later']) {
      const registration = await createRegistration(key, 'paid');
      const ticket = await prisma.ticket.create({
        data: {
          registrationId: registration.id,
          ticketCode: `T-${randomUUID()}`,
          qrSecret: randomUUID(),
          ...(key !== 'later' && { issuedAt }),
        },
      });
      ticketIds[key] = ticket.id;
    }
    await prisma.emailBroadcast.create({
      data: {
        eventId,
        subject: 'Join the WhatsApp group',
        bodyHtml: '<p>Hi {{name}}</p>',
        ctaLabel: 'Join',
        ctaUrl: GROUP_URL,
        audienceJson: { statuses: ['paid'] },
        recipientCount: 2,
        sentCount: 1,
        failedCount: 1,
        createdById: randomUUID(),
        createdAt: new Date(issuedAt.getTime() + 60_000),
        failures: {
          create: {
            email: emails.bounced,
            fullName: 'bounced Person',
            error: '550',
          },
        },
      },
    });
  }, 30000);

  afterAll(async () => {
    const registrations = await prisma.registration.findMany({
      where: { eventId },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: [eventId, ...registrations.map((r) => r.id)] } },
    });
    await prisma.emailBroadcast.deleteMany({ where: { eventId } });
    await prisma.ticket.deleteMany({
      where: { registration: { eventId } },
    });
    await prisma.order.deleteMany({ where: { registration: { eventId } } });
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.attendee.deleteMany({ where: { id: { in: attendeeIds } } });
    await prisma.ticketProduct.deleteMany({ where: { eventId } });
    const event = await prisma.event.delete({ where: { id: eventId } });
    await prisma.organization.delete({ where: { id: event.orgId } });
    await app.close();
  }, 60000);

  function getDeliveries() {
    return request(httpServer)
      .get(
        `/admin/tickets/email-deliveries?event=${eventSlug}&kind=whatsapp_invite`,
      )
      .set('Authorization', `Bearer ${organizerToken}`);
  }

  function sendInvites(ticketIdList?: string[]) {
    return request(httpServer)
      .post(`/admin/tickets/email-deliveries/resend?event=${eventSlug}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ kind: 'whatsapp_invite', ticketIds: ticketIdList });
  }

  function setLink(whatsappGroupUrl: string | null) {
    return request(httpServer)
      .put('/admin/broadcasts/whatsapp-invite')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ eventSlug, whatsappGroupUrl });
  }

  async function waitForSent(ticketId: string) {
    for (let i = 0; i < 120; i++) {
      const row = await prisma.ticketEmailDelivery.findUnique({
        where: { ticketId_kind: { ticketId, kind: 'whatsapp_invite' } },
      });
      if (row?.status === 'sent') return row;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Ticket ${ticketId} never got the WhatsApp invite`);
  }

  it('counts people reached by an earlier WhatsApp broadcast as sent', async () => {
    const res = await getDeliveries();
    expect(res.status).toBe(200);
    const body = res.body as DeliveriesBody;
    const statusOf = (key: string) =>
      body.rows.find((r) => r.ticketId === ticketIds[key])?.status;
    expect(statusOf('reached')).toBe('broadcast');
    expect(statusOf('bounced')).toBe('not_sent');
    expect(statusOf('later')).toBe('not_sent');
  });

  it('refuses to send until a link is set, and only accepts https links', async () => {
    expect((await sendInvites()).status).toBe(400);
    expect((await setLink('http://chat.whatsapp.com/x')).status).toBe(400);
    const res = await setLink(GROUP_URL);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ whatsappGroupUrl: GROUP_URL });
  });

  it('sends to everyone not yet sent, skipping broadcast recipients', async () => {
    broadcastSpy.mockClear();
    const res = await sendInvites();
    expect(res.status).toBe(201);
    expect((res.body as { queued: number }).queued).toBe(2);

    await waitForSent(ticketIds.bounced);
    await waitForSent(ticketIds.later);
    const recipients = broadcastSpy.mock.calls.map(([to]) => to as string);
    expect(recipients.sort()).toEqual([emails.bounced, emails.later].sort());
    expect((broadcastSpy.mock.calls as unknown[][])[0][1]).toMatchObject({
      ctaUrl: GROUP_URL,
    });

    expect((await sendInvites()).status).toBe(400);
  }, 60000);

  it('sends the invite automatically when a new ticket is issued', async () => {
    broadcastSpy.mockClear();
    const registration = await createRegistration(
      'newcomer',
      'pending_payment',
    );
    const { ticket } = await app
      .get(AdminService)
      .markPaid(registration.id, randomUUID(), 'paid at the door');

    await waitForSent(ticket.id);
    expect(broadcastSpy.mock.calls.map(([to]) => to as string)).toEqual([
      emails.newcomer,
    ]);
  }, 60000);

  it('does not send automatically once the link is cleared', async () => {
    expect((await setLink(null)).status).toBe(200);
    broadcastSpy.mockClear();
    const registration = await createRegistration('offline', 'pending_payment');
    const { ticket } = await app
      .get(AdminService)
      .markPaid(registration.id, randomUUID(), 'paid at the door');

    const row = await prisma.ticketEmailDelivery.findUnique({
      where: {
        ticketId_kind: { ticketId: ticket.id, kind: 'whatsapp_invite' },
      },
    });
    expect(row).toBeNull();
    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});
