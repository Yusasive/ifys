import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { createPaidCheckoutFixture } from '../testing/fixtures';

// TRD §11 priority 5: door staff must genuinely be unable to reach
// organizer-only data or actions. This drives real HTTP requests through
// the full guard chain (JwtAuthGuard -> RolesGuard), not a mocked one.
describe('Admin role scoping (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;
  let organizerToken: string;
  let doorStaffToken: string;

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

    const organizerLogin = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'organizer@ifysummit.ng', password: 'dev-organizer-pw' });
    organizerToken = (organizerLogin.body as { accessToken: string })
      .accessToken;

    const doorStaffLogin = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'doorstaff@ifysummit.ng', password: 'dev-doorstaff-pw' });
    doorStaffToken = (doorStaffLogin.body as { accessToken: string })
      .accessToken;
  });

  afterAll(async () => {
    await app.close();
  }, 15000);

  it('rejects login with a wrong password', async () => {
    const res = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'organizer@ifysummit.ng', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('allows an organizer to list registrations', async () => {
    const res = await request(httpServer)
      .get('/admin/registrations')
      .set('Authorization', `Bearer ${organizerToken}`);
    expect(res.status).toBe(200);
  });

  it('rejects door staff from the registrations list with 403', async () => {
    const res = await request(httpServer)
      .get('/admin/registrations')
      .set('Authorization', `Bearer ${doorStaffToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects door staff from the stats endpoint with 403', async () => {
    const res = await request(httpServer)
      .get('/admin/stats')
      .set('Authorization', `Bearer ${doorStaffToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(httpServer).get('/admin/registrations');
    expect(res.status).toBe(401);
  });

  it('rejects a request with a tampered token with 401', async () => {
    const res = await request(httpServer)
      .get('/admin/registrations')
      .set('Authorization', `Bearer ${organizerToken}tampered`);
    expect(res.status).toBe(401);
  });

  it('mark-paid issues a ticket and writes an audit log entry', async () => {
    const fixture = await createPaidCheckoutFixture(prisma, {
      orderStatus: 'pending',
    });
    try {
      const res = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/mark-paid`)
        .set('Authorization', `Bearer ${organizerToken}`);
      expect(res.status).toBe(201);

      const registration = await prisma.registration.findUniqueOrThrow({
        where: { id: fixture.registration.id },
      });
      expect(registration.status).toBe('paid');

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          action: 'mark_paid',
          targetType: 'registration',
          targetId: fixture.registration.id,
        },
      });
      expect(auditEntry).not.toBeNull();
    } finally {
      await prisma.auditLog.deleteMany({
        where: { targetId: fixture.registration.id },
      });
      await fixture.teardown();
    }
  });

  it('void requires the correct password and writes an audit log entry', async () => {
    const fixture = await createPaidCheckoutFixture(prisma, {
      orderStatus: 'pending',
    });
    try {
      await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/mark-paid`)
        .set('Authorization', `Bearer ${organizerToken}`);

      const wrongPassword = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/void`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ password: 'not-the-right-password' });
      expect(wrongPassword.status).toBe(401);

      const correctPassword = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/void`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ password: 'dev-organizer-pw' });
      expect(correctPassword.status).toBe(201);

      const ticket = await prisma.ticket.findUniqueOrThrow({
        where: { registrationId: fixture.registration.id },
      });
      expect(ticket.status).toBe('void');

      const auditEntry = await prisma.auditLog.findFirst({
        where: { action: 'void_ticket', targetId: ticket.id },
      });
      expect(auditEntry).not.toBeNull();
    } finally {
      const ticket = await prisma.ticket.findUnique({
        where: { registrationId: fixture.registration.id },
      });
      await prisma.auditLog.deleteMany({
        where: {
          targetId: { in: [fixture.registration.id, ticket?.id ?? ''] },
        },
      });
      await fixture.teardown();
    }
  });
});
