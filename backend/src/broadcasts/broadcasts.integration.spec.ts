import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module';
import { BroadcastEmailQueue } from '../email/broadcast-email.queue';
import { EmailService } from '../email/email.service';
import { unsubscribeLinks } from '../email/unsubscribe-links';
import { PrismaService } from '../prisma/prisma.service';
import { extractSessionToken } from '../testing/fixtures';

interface AudiencePreviewBody {
  count: number;
  sample: { email: string; fullName: string }[];
}

describe('Email broadcasts (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;
  let sendSpy: jest.SpyInstance;
  let organizerToken: string;
  let doorStaffToken: string;

  let eventId: string;
  let eventSlug: string;
  const registrationIds: Record<string, string> = {};
  const attendeeIds: string[] = [];
  const suffix = randomUUID();

  const content = {
    subject: 'Join the WhatsApp group',
    bodyHtml: '<p>Hi {{name}} <script>alert(1)</script></p>',
    ctaLabel: 'Join',
    ctaUrl: 'https://chat.whatsapp.com/abc',
  };

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
      .spyOn(app.get(EmailService), 'sendBroadcastEmail')
      .mockResolvedValue(undefined);

    organizerToken = extractSessionToken(
      await request(httpServer).post('/auth/login').send({
        email: 'organizer@ifysummit.ng',
        password: 'dev-organizer-pw',
      }),
    );
    doorStaffToken = extractSessionToken(
      await request(httpServer).post('/auth/login').send({
        email: 'doorstaff@ifysummit.ng',
        password: 'dev-doorstaff-pw',
      }),
    );

    const org = await prisma.organization.create({
      data: { name: `Broadcast Org ${suffix}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: 'Broadcast Test Event',
        venue: 'Test Venue',
        startsAt: new Date('2026-11-05T09:00:00+01:00'),
        slug: `broadcast-test-${suffix}`,
      },
    });
    eventId = event.id;
    eventSlug = event.slug;

    const products = {
      student: await prisma.ticketProduct.create({
        data: { eventId, category: 'student', tier: 'standard', priceKobo: 1 },
      }),
      professional: await prisma.ticketProduct.create({
        data: {
          eventId,
          category: 'professional',
          tier: 'premium',
          priceKobo: 1,
        },
      }),
    };

    // "dupe" shares an email (different case) with "studentPaid".
    const people = [
      ['studentPaid', 'student', 'paid', `amina-${suffix}@example.com`],
      [
        'studentPending',
        'student',
        'pending_payment',
        `bayo-${suffix}@example.com`,
      ],
      ['proPaid', 'professional', 'paid', `chidi-${suffix}@example.com`],
      ['dupe', 'professional', 'paid', `AMINA-${suffix}@example.com`],
    ] as const;
    for (const [key, category, status, email] of people) {
      const attendee = await prisma.attendee.create({
        data: { fullName: `${key} Person`, email, phone: '+2348000000000' },
      });
      attendeeIds.push(attendee.id);
      const registration = await prisma.registration.create({
        data: {
          eventId,
          attendeeId: attendee.id,
          ticketProductId: products[category].id,
          formDataJson: {},
          status,
        },
      });
      registrationIds[key] = registration.id;
    }
  }, 30000);

  afterAll(async () => {
    const broadcasts = await prisma.emailBroadcast.findMany({
      where: { eventId },
    });
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: broadcasts.map((b) => b.id) } },
    });
    await prisma.emailBroadcast.deleteMany({ where: { eventId } });
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.attendee.deleteMany({ where: { id: { in: attendeeIds } } });
    await prisma.ticketProduct.deleteMany({ where: { eventId } });
    const event = await prisma.event.delete({ where: { id: eventId } });
    await prisma.organization.delete({ where: { id: event.orgId } });
    await app.close();
  }, 60000);

  function post(path: string, body: object, token = organizerToken) {
    return request(httpServer)
      .post(`/admin/broadcasts${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  it('forbids door staff', async () => {
    const res = await post(
      '/audience-preview',
      { eventSlug, audience: {} },
      doorStaffToken,
    );
    expect(res.status).toBe(403);
  });

  it('filters by status and category, de-duplicating emails', async () => {
    const paid = await post('/audience-preview', {
      eventSlug,
      audience: { statuses: ['paid'] },
    });
    expect(paid.status).toBe(201);
    // studentPaid + proPaid; "dupe" collapses into studentPaid's email.
    expect((paid.body as AudiencePreviewBody).count).toBe(2);

    const studentsAnyStatus = await post('/audience-preview', {
      eventSlug,
      audience: { categories: ['student'] },
    });
    expect((studentsAnyStatus.body as AudiencePreviewBody).count).toBe(2);

    const premiumPaid = await post('/audience-preview', {
      eventSlug,
      audience: { tiers: ['premium'], statuses: ['paid'] },
    });
    expect((premiumPaid.body as AudiencePreviewBody).count).toBe(2);
  });

  it('uses hand-picked registrations instead of filters when given', async () => {
    const res = await post('/audience-preview', {
      eventSlug,
      audience: {
        registrationIds: [registrationIds.studentPending],
        statuses: ['paid'],
      },
    });
    expect((res.body as AudiencePreviewBody).count).toBe(1);
    expect((res.body as AudiencePreviewBody).sample[0].fullName).toBe(
      'studentPending Person',
    );
  });

  it('rejects a blank body, a half-filled button and a javascript: link', async () => {
    const blank = await post('/preview', {
      eventSlug,
      ...content,
      bodyHtml: '<p> </p>',
    });
    expect(blank.status).toBe(400);

    const halfCta = await post('/preview', {
      eventSlug,
      ...content,
      ctaUrl: undefined,
    });
    expect(halfCta.status).toBe(400);

    const badUrl = await post('/preview', {
      eventSlug,
      ...content,
      ctaUrl: 'javascript:alert(1)',
    });
    expect(badUrl.status).toBe(400);
  });

  it('renders a sanitized, personalized preview', async () => {
    const res = await post('/preview', { eventSlug, ...content });
    expect(res.status).toBe(201);
    expect((res.body as { html: string }).html).toContain('Hi Aisha');
    expect((res.body as { html: string }).html).not.toContain('<script');
    expect((res.body as { html: string }).html).toContain(
      'https://chat.whatsapp.com/abc',
    );
  });

  it('sends one email per unique recipient and tracks progress', async () => {
    const res = await post('', {
      eventSlug,
      ...content,
      audience: { statuses: ['paid'] },
    });
    expect(res.status).toBe(201);
    const sent = res.body as { id: string; recipientCount: number };
    expect(sent.recipientCount).toBe(2);

    const stored = await prisma.emailBroadcast.findUniqueOrThrow({
      where: { id: sent.id },
    });
    expect(stored.bodyHtml).not.toContain('<script');

    // Wait for the worker to drain the two jobs — generously, since the
    // queue is rate-limited and shared with any jobs left in Redis.
    let current = stored;
    for (let i = 0; i < 120 && current.sentCount < 2; i++) {
      await new Promise((r) => setTimeout(r, 250));
      current = await prisma.emailBroadcast.findUniqueOrThrow({
        where: { id: sent.id },
      });
    }
    expect(current.sentCount).toBe(2);
    expect(current.failedCount).toBe(0);

    const recipients = sendSpy.mock.calls
      .filter(
        ([, data]) => (data as { subject: string }).subject === content.subject,
      )
      .map(([to]) => (to as string).toLowerCase())
      .sort();
    expect(recipients).toEqual([
      `amina-${suffix}@example.com`,
      `chidi-${suffix}@example.com`,
    ]);

    const list = await request(httpServer)
      .get(`/admin/broadcasts?event=${eventSlug}`)
      .set('Authorization', `Bearer ${organizerToken}`);
    const [latest] = list.body as {
      id: string;
      recipientCount: number;
      createdByName: string | null;
    }[];
    expect(latest.id).toBe(sent.id);
    expect(latest.recipientCount).toBe(2);
    expect(latest.createdByName).toBeTruthy();
  }, 60000);

  it('lists failed recipients and resends to just them', async () => {
    const res = await post('', {
      eventSlug,
      ...content,
      audience: { registrationIds: [registrationIds.proPaid] },
    });
    const { id } = res.body as { id: string };
    let current = await prisma.emailBroadcast.findUniqueOrThrow({
      where: { id },
    });
    for (let i = 0; i < 120 && current.sentCount < 1; i++) {
      await new Promise((r) => setTimeout(r, 250));
      current = await prisma.emailBroadcast.findUniqueOrThrow({
        where: { id },
      });
    }

    // Simulate that send having run out of retries.
    const email = `chidi-${suffix}@example.com`;
    await prisma.emailBroadcast.update({
      where: { id },
      data: { sentCount: 0, failedCount: 1 },
    });
    await prisma.emailBroadcastFailure.create({
      data: {
        broadcastId: id,
        email,
        fullName: 'proPaid Person',
        error: '550 Mailbox unavailable',
      },
    });

    const failures = await request(httpServer)
      .get(`/admin/broadcasts/${id}/failures`)
      .set('Authorization', `Bearer ${organizerToken}`);
    expect(failures.status).toBe(200);
    expect(failures.body).toEqual([
      expect.objectContaining({ email, error: '550 Mailbox unavailable' }),
    ]);

    const callsBefore = sendSpy.mock.calls.filter(
      ([to]) => to === email,
    ).length;
    const resend = await post(`/${id}/resend-failed`, {});
    expect(resend.status).toBe(201);
    expect((resend.body as { recipientCount: number }).recipientCount).toBe(1);

    current = await prisma.emailBroadcast.findUniqueOrThrow({
      where: { id },
    });
    for (let i = 0; i < 120 && current.sentCount < 1; i++) {
      await new Promise((r) => setTimeout(r, 250));
      current = await prisma.emailBroadcast.findUniqueOrThrow({
        where: { id },
      });
    }
    expect(current.sentCount).toBe(1);
    expect(current.failedCount).toBe(0);
    expect(sendSpy.mock.calls.filter(([to]) => to === email).length).toBe(
      callsBefore + 1,
    );
    expect(
      await prisma.emailBroadcastFailure.count({ where: { broadcastId: id } }),
    ).toBe(0);

    const again = await post(`/${id}/resend-failed`, {});
    expect(again.status).toBe(400);
  }, 60000);

  it('records a recipient whose send runs out of retries', async () => {
    const broadcast = await prisma.emailBroadcast.create({
      data: {
        eventId,
        subject: 'Failure test',
        bodyHtml: '<p>Hi</p>',
        audienceJson: {},
        recipientCount: 1,
        createdById: randomUUID(),
      },
    });
    const email = `bayo-${suffix}@example.com`;
    sendSpy.mockRejectedValueOnce(new Error('554 Rejected by Zoho'));

    // A single attempt, so the failure is final without waiting on backoff.
    // Bracket access reaches the private queue (TS allows it for tests).
    const queue = app.get(BroadcastEmailQueue)['queue'];
    await queue.add(
      'send',
      { broadcastId: broadcast.id, email, fullName: 'Bayo' },
      { attempts: 1 },
    );

    let failures: { email: string; error: string }[] = [];
    for (let i = 0; i < 120 && failures.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 250));
      failures = await prisma.emailBroadcastFailure.findMany({
        where: { broadcastId: broadcast.id },
      });
    }
    expect(failures).toEqual([
      expect.objectContaining({ email, error: '554 Rejected by Zoho' }),
    ]);
    const stored = await prisma.emailBroadcast.findUniqueOrThrow({
      where: { id: broadcast.id },
    });
    expect(stored.failedCount).toBe(1);
  }, 60000);

  it('leaves out recipients who unsubscribed with a valid link', async () => {
    const email = `chidi-${suffix}@example.com`;
    const { searchParams } = new URL(
      unsubscribeLinks(
        email,
        'https://ifysummit.com',
        process.env.JWT_SECRET as string,
      ).oneClickUrl,
    );

    const forged = await request(httpServer)
      .post('/email/unsubscribe')
      .send({ email, token: 'not-the-real-signature' });
    expect(forged.status).toBe(401);

    // Case differs from the stored attendee email; the token still matches.
    const ok = await request(httpServer)
      .post('/email/unsubscribe')
      .send({ email: email.toUpperCase(), token: searchParams.get('t') });
    expect(ok.status).toBe(200);

    try {
      const res = await post('/audience-preview', {
        eventSlug,
        audience: { statuses: ['paid'] },
      });
      const body = res.body as AudiencePreviewBody;
      expect(body.count).toBe(1);
      expect(body.sample.map((r) => r.email.toLowerCase())).toEqual([
        `amina-${suffix}@example.com`,
      ]);
    } finally {
      await prisma.emailUnsubscribe.delete({ where: { email } });
    }
  });

  it('refuses to send when nobody matches', async () => {
    const res = await post('', {
      eventSlug,
      ...content,
      audience: { statuses: ['refunded'] },
    });
    expect(res.status).toBe(400);
  });
});
