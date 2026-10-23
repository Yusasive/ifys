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

describe('Change attendee email (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;
  let sendSpy: jest.SpyInstance;
  let superAdminToken: string;
  let organizerToken: string;

  let eventId: string;
  let registrationId: string;
  let ticketId: string;
  let attendeeId: string;
  const suffix = randomUUID();
  const oldEmail = `dead-${suffix}@example.com`;
  const newEmail = `working-${suffix}@example.com`;

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

    const org = await prisma.organization.create({
      data: { name: `Change Email Org ${suffix}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: 'Change Email Test Event',
        venue: 'Test Venue',
        startsAt: new Date('2026-11-05T09:00:00+01:00'),
        slug: `change-email-test-${suffix}`,
      },
    });
    eventId = event.id;
    const product = await prisma.ticketProduct.create({
      data: {
        eventId,
        category: 'professional',
        tier: 'standard',
        priceKobo: 1,
      },
    });
    const attendee = await prisma.attendee.create({
      data: { fullName: 'Bola Ade', email: oldEmail, phone: '+2348000000000' },
    });
    attendeeId = attendee.id;
    const registration = await prisma.registration.create({
      data: {
        eventId,
        attendeeId,
        ticketProductId: product.id,
        formDataJson: {},
        status: 'paid',
      },
    });
    registrationId = registration.id;
    const ticket = await prisma.ticket.create({
      data: {
        registrationId,
        ticketCode: `T-${randomUUID()}`,
        qrSecret: randomUUID(),
      },
    });
    ticketId = ticket.id;
  }, 30000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: [registrationId, ticketId] } },
    });
    await prisma.ticketEmailDelivery.deleteMany({ where: { ticketId } });
    await prisma.ticket.delete({ where: { id: ticketId } });
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.attendee.delete({ where: { id: attendeeId } });
    await prisma.ticketProduct.deleteMany({ where: { eventId } });
    const event = await prisma.event.delete({ where: { id: eventId } });
    await prisma.organization.delete({ where: { id: event.orgId } });
    await app.close();
  }, 60000);

  function changeEmail(body: object, token = superAdminToken) {
    return request(httpServer)
      .patch(`/admin/registrations/${registrationId}/email`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  it('forbids organizers', async () => {
    const res = await changeEmail(
      { email: newEmail, reason: 'typo' },
      organizerToken,
    );
    expect(res.status).toBe(403);
  });

  it('rejects an invalid address and a missing reason', async () => {
    expect((await changeEmail({ email: 'nope', reason: 'x' })).status).toBe(
      400,
    );
    expect((await changeEmail({ email: newEmail })).status).toBe(400);
  });

  it('updates the address, records it, and the resend goes there', async () => {
    const res = await changeEmail({
      email: newEmail,
      reason: 'old address bounces',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: newEmail });

    const attendee = await prisma.attendee.findUniqueOrThrow({
      where: { id: attendeeId },
    });
    expect(attendee.email).toBe(newEmail);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'change_attendee_email', targetId: registrationId },
    });
    expect(log.metadataJson).toEqual({
      from: oldEmail,
      to: newEmail,
      reason: 'old address bounces',
    });

    sendSpy.mockClear();
    const resend = await request(httpServer)
      .post(`/admin/registrations/${registrationId}/resend-ticket`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(resend.status).toBe(201);
    for (let i = 0; i < 120 && sendSpy.mock.calls.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(sendSpy.mock.calls.map(([to]) => to as string)).toEqual([newEmail]);
  }, 60000);

  it('refuses to "change" to the same address', async () => {
    const res = await changeEmail({
      email: newEmail.toUpperCase(),
      reason: 'again',
    });
    expect(res.status).toBe(400);
  });
});
