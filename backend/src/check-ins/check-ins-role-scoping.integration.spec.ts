import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { createPaidCheckoutFixture } from '../testing/fixtures';
import { TicketsService } from '../tickets/tickets.service';

// TRD §4/§11: check-in is reachable by door_staff or organizer, and the
// scan endpoint is where §5/§10's rate limiting explicitly applies.
describe('Check-in role scoping and rate limiting (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;
  let tickets: TicketsService;
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
    tickets = app.get(TicketsService);

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

  it('allows door staff to scan', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      const ticket = await tickets.issueTicketForRegistration(
        fixture.registration.id,
      );
      const res = await request(httpServer)
        .post('/checkin/scan')
        .set('Authorization', `Bearer ${doorStaffToken}`)
        .send({ shortCode: ticket.ticketCode, stationId: 'station-1' });
      expect(res.status).toBe(201);
      expect((res.body as { result: string }).result).toBe('valid_first_use');
    } finally {
      await fixture.teardown();
    }
  });

  it('allows an organizer to scan', async () => {
    const fixture = await createPaidCheckoutFixture(prisma);
    try {
      const ticket = await tickets.issueTicketForRegistration(
        fixture.registration.id,
      );
      const res = await request(httpServer)
        .post('/checkin/scan')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ shortCode: ticket.ticketCode, stationId: 'station-1' });
      expect(res.status).toBe(201);
    } finally {
      await fixture.teardown();
    }
  });

  it('rejects an unauthenticated scan with 401', async () => {
    const res = await request(httpServer)
      .post('/checkin/scan')
      .send({ shortCode: 'ZZZZZZ', stationId: 'station-1' });
    expect(res.status).toBe(401);
  });

  it('rejects a scan request missing stationId with 400', async () => {
    const res = await request(httpServer)
      .post('/checkin/scan')
      .set('Authorization', `Bearer ${doorStaffToken}`)
      .send({ shortCode: 'ZZZZZZ' });
    expect(res.status).toBe(400);
  });

  it('door staff can read live status counts', async () => {
    const res = await request(httpServer)
      .get('/checkin/status')
      .set('Authorization', `Bearer ${doorStaffToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('checkedIn');
    expect(res.body).toHaveProperty('totalTickets');
  });
});
