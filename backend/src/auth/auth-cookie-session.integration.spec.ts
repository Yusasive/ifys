import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { createPaidCheckoutFixture } from '../testing/fixtures';

describe('Cookie-based admin session (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
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
  });

  afterAll(async () => {
    await app.close();
  }, 15000);

  function cookiesFrom(res: {
    headers: Record<string, string | string[] | undefined>;
  }): string[] {
    const raw = res.headers['set-cookie'];
    return Array.isArray(raw) ? raw : raw ? [raw] : [];
  }

  function extract(cookies: string[], name: string): string {
    for (const cookie of cookies) {
      const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(cookie);
      if (match) return decodeURIComponent(match[1]);
    }
    throw new Error(`cookie ${name} not found`);
  }

  it('login sets an httpOnly session cookie, returns the CSRF token in the body, and never returns the access token in the body', async () => {
    const res = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'organizer@ifysummit.ng', password: 'dev-organizer-pw' });

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('accessToken');
    expect((res.body as { user: { email: string } }).user.email).toBe(
      'organizer@ifysummit.ng',
    );
    expect(typeof (res.body as { csrfToken: string }).csrfToken).toBe('string');

    const cookies = cookiesFrom(res);
    const sessionCookie = cookies.find((c) => c.startsWith('admin_session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);
  });

  it('rejects a mutating admin request over cookie auth without a matching CSRF header', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'organizer@ifysummit.ng', password: 'dev-organizer-pw' });
    const cookies = cookiesFrom(login);
    const sessionCookie = cookies
      .find((c) => c.startsWith('admin_session='))!
      .split(';')[0];
    const csrfToken = (login.body as { csrfToken: string }).csrfToken;

    const fixture = await createPaidCheckoutFixture(prisma, {
      orderStatus: 'pending',
    });
    try {
      const withoutHeader = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/mark-paid`)
        .set('Cookie', sessionCookie);
      expect(withoutHeader.status).toBe(403);

      const withWrongHeader = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/mark-paid`)
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', 'not-the-real-token');
      expect(withWrongHeader.status).toBe(403);

      const withCorrectHeader = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/mark-paid`)
        .set('Cookie', sessionCookie)
        .set('X-CSRF-Token', csrfToken)
        .send({ reason: 'Bank transfer confirmed manually' });
      expect(withCorrectHeader.status).toBe(201);
    } finally {
      await prisma.auditLog.deleteMany({
        where: { targetId: fixture.registration.id },
      });
      await fixture.teardown();
    }
  });

  it('does not require a CSRF header for Bearer-token auth (not cookie-driven, not CSRF-exploitable)', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'organizer@ifysummit.ng', password: 'dev-organizer-pw' });
    const token = extract(cookiesFrom(login), 'admin_session');

    const fixture = await createPaidCheckoutFixture(prisma, {
      orderStatus: 'pending',
    });
    try {
      const res = await request(httpServer)
        .post(`/admin/registrations/${fixture.registration.id}/mark-paid`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Bank transfer confirmed manually' });
      expect(res.status).toBe(201);
    } finally {
      await prisma.auditLog.deleteMany({
        where: { targetId: fixture.registration.id },
      });
      await fixture.teardown();
    }
  });

  it('logout revokes the session immediately, even before it would naturally expire', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'organizer@ifysummit.ng', password: 'dev-organizer-pw' });
    const token = extract(cookiesFrom(login), 'admin_session');

    const preLogout = await request(httpServer)
      .get('/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(preLogout.status).toBe(200);

    const logout = await request(httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(201);

    const postLogout = await request(httpServer)
      .get('/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(postLogout.status).toBe(401);
  });

  it('revokeAllSessions invalidates outstanding tokens by bumping tokenVersion', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'organizer@ifysummit.ng', password: 'dev-organizer-pw' });
    const token = extract(cookiesFrom(login), 'admin_session');

    const user = await prisma.adminUser.findUniqueOrThrow({
      where: { email: 'organizer@ifysummit.ng' },
    });
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });

    try {
      const res = await request(httpServer)
        .get('/admin/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    } finally {
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { tokenVersion: user.tokenVersion },
      });
    }
  });

  it('GET /auth/me returns the current user for a valid session', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({ email: 'organizer@ifysummit.ng', password: 'dev-organizer-pw' });
    const token = extract(cookiesFrom(login), 'admin_session');

    const res = await request(httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as { user: { email: string } }).user.email).toBe(
      'organizer@ifysummit.ng',
    );
  });
});
