import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { extractSessionToken } from '../testing/fixtures';

// M6 + Phase 4 remediation: only super_admin can provision real accounts
// without editing the seed script — organizer alone must not be able to
// mint other organizer (or super_admin) accounts.
describe('Admin user management (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;
  let superAdminToken: string;
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

    const superAdminLogin = await request(httpServer).post('/auth/login').send({
      email: 'superadmin@ifysummit.ng',
      password: 'dev-superadmin-pw',
    });
    superAdminToken = extractSessionToken(superAdminLogin);

    const organizerLogin = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'organizer@ifysummit.ng', password: 'dev-organizer-pw' });
    organizerToken = extractSessionToken(organizerLogin);

    const doorStaffLogin = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'doorstaff@ifysummit.ng', password: 'dev-doorstaff-pw' });
    doorStaffToken = extractSessionToken(doorStaffLogin);
  });

  afterAll(async () => {
    await app.close();
  }, 15000);

  it('lets a super_admin create a new door-staff account, which can then log in', async () => {
    const email = `door-${randomUUID()}@example.com`;
    const password = 'a-strong-test-password';

    const createRes = await request(httpServer)
      .post('/admin/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'New Door Volunteer',
        email,
        password,
        role: 'door_staff',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).not.toHaveProperty('passwordHash');
    expect(createRes.body).not.toHaveProperty('password');

    const loginRes = await request(httpServer)
      .post('/auth/login')
      .send({ email, password });
    expect(loginRes.status).toBe(201);
    expect((loginRes.body as { user: { role: string } }).user.role).toBe(
      'door_staff',
    );

    const createdId = (createRes.body as { id: string }).id;
    const auditEntry = await prisma.auditLog.findFirst({
      where: { action: 'create_admin_user', targetId: createdId },
    });
    expect(auditEntry).not.toBeNull();

    await prisma.adminUser.delete({ where: { email } });
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await request(httpServer)
      .post('/admin/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Duplicate',
        email: 'organizer@ifysummit.ng',
        password: 'whatever-password',
        role: 'door_staff',
      });
    expect(res.status).toBe(409);
  });

  it('rejects a short password', async () => {
    const res = await request(httpServer)
      .post('/admin/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Too Short',
        email: `short-${randomUUID()}@example.com`,
        password: 'short',
        role: 'door_staff',
      });
    expect(res.status).toBe(400);
  });

  it('rejects door staff from creating or listing admin users', async () => {
    const createRes = await request(httpServer)
      .post('/admin/users')
      .set('Authorization', `Bearer ${doorStaffToken}`)
      .send({
        name: 'Should Not Work',
        email: `blocked-${randomUUID()}@example.com`,
        password: 'whatever-password',
        role: 'organizer',
      });
    expect(createRes.status).toBe(403);

    const listRes = await request(httpServer)
      .get('/admin/users')
      .set('Authorization', `Bearer ${doorStaffToken}`);
    expect(listRes.status).toBe(403);
  });

  it('rejects an organizer from creating admin accounts (super_admin-only) but still allows listing them', async () => {
    const createRes = await request(httpServer)
      .post('/admin/users')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        name: 'Should Not Work Either',
        email: `blocked-${randomUUID()}@example.com`,
        password: 'whatever-password',
        role: 'door_staff',
      });
    expect(createRes.status).toBe(403);

    const listRes = await request(httpServer)
      .get('/admin/users')
      .set('Authorization', `Bearer ${organizerToken}`);
    expect(listRes.status).toBe(200);
  });

  it('lists admin users without exposing password hashes', async () => {
    const res = await request(httpServer)
      .get('/admin/users')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    const { users } = res.body as { users: unknown[] };
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    for (const user of users) {
      expect(user).not.toHaveProperty('passwordHash');
    }
  });
});
