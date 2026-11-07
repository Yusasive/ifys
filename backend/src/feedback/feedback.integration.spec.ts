import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { extractSessionToken } from '../testing/fixtures';
import { FEEDBACK_FORM } from './feedback-form';
import { validAnswers } from './testing-answers';

describe('Feedback form (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;
  let organizerToken: string;
  let doorStaffToken: string;
  let eventId: string;
  let eventSlug: string;
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
      data: { name: `Feedback Org ${suffix}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: 'Feedback Test Event',
        venue: 'Test Venue',
        startsAt: new Date('2026-11-05T09:00:00+01:00'),
        slug: `feedback-test-${suffix}`,
      },
    });
    eventId = event.id;
    eventSlug = event.slug;
  }, 30000);

  afterAll(async () => {
    await prisma.feedbackSubmission.deleteMany({ where: { eventId } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await app.close();
  }, 30000);

  const submit = (body: Record<string, unknown>) =>
    request(httpServer)
      .post('/feedback')
      .send({ eventSlug, ...body });

  it('serves the form publicly', async () => {
    const res = await request(httpServer).get('/feedback/form');
    expect(res.status).toBe(200);
    const body = res.body as typeof FEEDBACK_FORM;
    expect(body.roles.map((r) => r.value)).toEqual([
      'attendee',
      'speaker',
      'sponsor',
    ]);
  });

  it('accepts a complete submission for each role', async () => {
    for (const role of ['attendee', 'speaker', 'sponsor'] as const) {
      const res = await submit({ role, answers: validAnswers(role) });
      expect(res.status).toBe(201);
    }
    expect(await prisma.feedbackSubmission.count({ where: { eventId } })).toBe(
      3,
    );
  });

  it('stores optional contact details and the testimonial consent', async () => {
    const res = await submit({
      role: 'attendee',
      answers: validAnswers('attendee'),
      consent: 'yes',
      name: '  Amina  ',
      email: 'Amina@Example.com',
    });
    expect(res.status).toBe(201);
    const row = await prisma.feedbackSubmission.findUniqueOrThrow({
      where: { id: (res.body as { id: string }).id },
    });
    expect(row.name).toBe('Amina');
    expect(row.email).toBe('amina@example.com');
    expect(row.testimonialConsent).toBe(true);
  });

  it('ignores bot submissions that fill the hidden field', async () => {
    const before = await prisma.feedbackSubmission.count({
      where: { eventId },
    });
    const res = await submit({
      role: 'speaker',
      answers: validAnswers('speaker'),
      website: 'http://spam.example',
    });
    expect(res.status).toBe(201);
    expect(await prisma.feedbackSubmission.count({ where: { eventId } })).toBe(
      before,
    );
  });

  it('requires a name when the testimonial consent is Yes', async () => {
    const res = await submit({
      role: 'attendee',
      answers: validAnswers('attendee'),
      consent: 'yes',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a missing required answer', async () => {
    const answers = validAnswers('attendee');
    delete answers.overall;
    const res = await submit({ role: 'attendee', answers });
    expect(res.status).toBe(400);
  });

  it('404s for an unknown event', async () => {
    const res = await request(httpServer)
      .post('/feedback')
      .send({
        eventSlug: 'nope',
        role: 'speaker',
        answers: validAnswers('speaker'),
      });
    expect(res.status).toBe(404);
  });

  it('keeps responses private to staff with the feedback.view permission', async () => {
    const anon = await request(httpServer).get(
      `/admin/feedback?event=${eventSlug}`,
    );
    expect(anon.status).toBe(401);

    const door = await request(httpServer)
      .get(`/admin/feedback?event=${eventSlug}`)
      .set('Authorization', `Bearer ${doorStaffToken}`);
    expect(door.status).toBe(403);

    const organizer = await request(httpServer)
      .get(`/admin/feedback?event=${eventSlug}`)
      .set('Authorization', `Bearer ${organizerToken}`);
    expect(organizer.status).toBe(200);
    const body = organizer.body as { submissions: unknown[] };
    expect(body.submissions.length).toBeGreaterThan(0);
  });
});
