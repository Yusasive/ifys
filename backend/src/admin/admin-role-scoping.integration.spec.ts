import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_DEFAULT_PERMISSIONS } from '../auth/permissions';
import {
  createPaidCheckoutFixture,
  extractSessionToken,
} from '../testing/fixtures';

// TRD §11 priority 5: door staff must genuinely be unable to reach
// organizer-only data or actions. This drives real HTTP requests through
// the full guard chain (JwtAuthGuard -> RolesGuard), not a mocked one.
describe('Admin role scoping (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;
  let organizerToken: string;
  let doorStaffToken: string;
  let superAdminToken: string;

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
    organizerToken = extractSessionToken(organizerLogin);

    const doorStaffLogin = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'doorstaff@ifysummit.ng', password: 'dev-doorstaff-pw' });
    doorStaffToken = extractSessionToken(doorStaffLogin);

    const superAdminLogin = await request(httpServer).post('/auth/login').send({
      email: 'superadmin@ifysummit.ng',
      password: 'dev-superadmin-pw',
    });
    superAdminToken = extractSessionToken(superAdminLogin);
  }, 20000);

  // Generous timeout: app.close() waits for BullMQ workers to finish any
  // in-flight job, and this file now exercises several email-enqueuing
  // actions (mark-paid, void, reissue, restore, withdraw) — in this dev
  // environment without real SMTP, a job can take a while to time out at
  // the network level (slower than the fast-fail "Invalid login" case)
  // before the worker is free to close.
  afterAll(async () => {
    await app.close();
  }, 60000);

  async function markPaid(registrationId: string) {
    await request(httpServer)
      .post(`/admin/registrations/${registrationId}/mark-paid`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ reason: 'test setup' });
  }

  async function cleanupAuditLogs(registrationId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { registrationId },
    });
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: [registrationId, ticket?.id ?? ''] } },
    });
  }

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
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ reason: 'Bank transfer confirmed manually' });
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
  }, 45000);

  it('void requires the correct password and writes an audit log entry', async () => {
    const fixture = await createPaidCheckoutFixture(prisma, {
      orderStatus: 'pending',
    });
    try {
      await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/mark-paid`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ reason: 'Bank transfer confirmed manually' });

      const wrongPassword = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/void`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          reason: 'Duplicate registration',
          password: 'not-the-right-password',
        });
      expect(wrongPassword.status).toBe(401);

      const correctPassword = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/void`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          reason: 'Duplicate registration',
          password: 'dev-organizer-pw',
        });
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
  }, 45000);

  // Covers the reissue/restore/withdraw ticket lifecycle actions' guard
  // paths (withdraw only after a reissue, restore only when void, etc.) —
  // the code-generation behavior itself is covered by
  // tickets.service.integration.spec.ts.
  it('reissues a ticket with a new code, then blocks withdraw on a non-reissued ticket', async () => {
    const fixture = await createPaidCheckoutFixture(prisma, {
      orderStatus: 'pending',
    });
    try {
      await markPaid(fixture.registration.id);
      const original = await prisma.ticket.findUniqueOrThrow({
        where: { registrationId: fixture.registration.id },
      });

      const reissue = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/reissue-ticket`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ reason: 'lost original' });
      expect(reissue.status).toBe(201);

      const reissued = await prisma.ticket.findUniqueOrThrow({
        where: { registrationId: fixture.registration.id },
      });
      expect(reissued.ticketCode).not.toBe(original.ticketCode);
      expect(reissued.lastActionType).toBe('reissued');
      expect(reissued.lastActionReason).toBe('lost original');

      const withdraw = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/withdraw-ticket`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          reason: 'attendee no longer attending',
          password: 'dev-organizer-pw',
        });
      expect(withdraw.status).toBe(201);

      const withdrawn = await prisma.ticket.findUniqueOrThrow({
        where: { registrationId: fixture.registration.id },
      });
      expect(withdrawn.status).toBe('void');
      expect(withdrawn.lastActionType).toBe('withdrawn');

      // Now that it's void, a second withdraw attempt must be rejected.
      const secondWithdraw = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/withdraw-ticket`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ reason: 'retry', password: 'dev-organizer-pw' });
      expect(secondWithdraw.status).toBe(409);
    } finally {
      await cleanupAuditLogs(fixture.registration.id);
      await fixture.teardown();
    }
  }, 45000);

  it('rejects withdraw on a ticket that was never reissued, and restore on one that is not void', async () => {
    const fixture = await createPaidCheckoutFixture(prisma, {
      orderStatus: 'pending',
    });
    try {
      await markPaid(fixture.registration.id);

      const withdraw = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/withdraw-ticket`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          reason: 'attendee no longer attending',
          password: 'dev-organizer-pw',
        });
      expect(withdraw.status).toBe(409);

      const restore = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/restore-ticket`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ reason: 'not void yet' });
      expect(restore.status).toBe(409);
    } finally {
      await cleanupAuditLogs(fixture.registration.id);
      await fixture.teardown();
    }
  }, 45000);

  it('restores a void ticket to unused using the same code', async () => {
    const fixture = await createPaidCheckoutFixture(prisma, {
      orderStatus: 'pending',
    });
    try {
      await markPaid(fixture.registration.id);
      const original = await prisma.ticket.findUniqueOrThrow({
        where: { registrationId: fixture.registration.id },
      });

      await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/void`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ reason: 'voided in error', password: 'dev-organizer-pw' });

      const restore = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/restore-ticket`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ reason: 'voided in error, restoring' });
      expect(restore.status).toBe(201);

      const restored = await prisma.ticket.findUniqueOrThrow({
        where: { registrationId: fixture.registration.id },
      });
      expect(restored.status).toBe('unused');
      expect(restored.ticketCode).toBe(original.ticketCode);
      expect(restored.lastActionType).toBe('restored');
    } finally {
      await cleanupAuditLogs(fixture.registration.id);
      await fixture.teardown();
    }
  }, 45000);

  it('creates an organizer with the role default permission set when none is given', async () => {
    const email = `test-organizer-${randomUUID()}@example.com`;
    const res = await request(httpServer)
      .post('/admin/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Test Organizer',
        email,
        password: 'temp-password-123',
        role: 'organizer',
      });
    expect(res.status).toBe(201);
    const body = res.body as { id: string; permissions: string[] };
    expect(new Set(body.permissions)).toEqual(
      new Set(ROLE_DEFAULT_PERMISSIONS.organizer),
    );

    await prisma.adminUser.delete({ where: { id: body.id } });
  }, 45000);

  it('lets a super_admin grant a custom permission set to one specific admin', async () => {
    const email = `test-organizer-${randomUUID()}@example.com`;
    const created = await request(httpServer)
      .post('/admin/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Test Organizer',
        email,
        password: 'temp-password-123',
        role: 'organizer',
        permissions: ['registrations.view'],
      });
    expect(created.status).toBe(201);
    const body = created.body as { id: string; permissions: string[] };
    expect(body.permissions).toEqual(['registrations.view']);

    await prisma.adminUser.delete({ where: { id: body.id } });
  }, 45000);

  it('revoking a permission takes effect on the very next request, with no forced re-login', async () => {
    const email = `test-organizer-${randomUUID()}@example.com`;
    const created = await request(httpServer)
      .post('/admin/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Test Organizer',
        email,
        password: 'temp-password-123',
        role: 'organizer',
      });
    const userId = (created.body as { id: string }).id;

    const login = await request(httpServer)
      .post('/auth/login')
      .send({ email, password: 'temp-password-123' });
    const token = extractSessionToken(login);

    const fixture = await createPaidCheckoutFixture(prisma, {
      orderStatus: 'pending',
    });
    try {
      // Still has the organizer default, which includes voidTicket.
      const beforeRevoke = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/mark-paid`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'test' });
      expect(beforeRevoke.status).toBe(201);

      await request(httpServer)
        .patch(`/admin/users/${userId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ permissions: ['registrations.view'] });

      // Same token, no re-login — the void permission is gone now.
      const afterRevoke = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/void`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'test', password: 'temp-password-123' });
      expect(afterRevoke.status).toBe(403);
    } finally {
      await cleanupAuditLogs(fixture.registration.id);
      await fixture.teardown();
      await prisma.adminUser.delete({ where: { id: userId } });
    }
  }, 45000);

  it('admin-user management stays super_admin-only regardless of any granted permission', async () => {
    const res = await request(httpServer)
      .post('/admin/users')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Should not be created',
        email: `test-organizer-${randomUUID()}@example.com`,
        password: 'temp-password-123',
        role: 'organizer',
      });
    expect(res.status).toBe(403);
  }, 45000);
});
