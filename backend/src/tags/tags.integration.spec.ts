import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { extractSessionToken } from '../testing/fixtures';
import type { NameTag } from './tags.service';

interface TagsBody {
  committee: NameTag[];
  registrants: NameTag[];
  speakers: NameTag[];
  sponsors: NameTag[];
}

describe('Name tags (integration)', () => {
  let app: INestApplication;
  let httpServer: App;
  let prisma: PrismaService;
  let organizerToken: string;
  let doorStaffToken: string;

  let eventId: string;
  let eventSlug: string;
  const attendeeIds: string[] = [];
  // Positions/members created through the API — some are deleted mid-test,
  // so their audit rows can't be found from the tables in afterAll.
  const committeeIds: string[] = [];
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
      data: { name: `Tags Org ${suffix}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        name: 'Tags Test Event',
        venue: 'Test Venue',
        startsAt: new Date('2026-11-05T09:00:00+01:00'),
        slug: `tags-test-${suffix}`,
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
          tier: 'standard',
          priceKobo: 1,
        },
      }),
    };

    const people = [
      [
        'Amina Student',
        'student',
        'paid',
        'unused',
        { institution: 'UNILORIN' },
      ],
      [
        'Chidi Pro',
        'professional',
        'paid',
        'used',
        { role: 'CEO', organization: 'Stecs' },
      ],
      ['Voided Person', 'professional', 'paid', 'void', { role: 'X' }],
      ['Pending Person', 'professional', 'pending_payment', null, {}],
      ['Review Person', 'student', 'pending_review', null, {}],
    ] as const;
    for (const [fullName, category, status, ticketStatus, form] of people) {
      const attendee = await prisma.attendee.create({
        data: {
          fullName,
          email: `${randomUUID()}@example.com`,
          phone: '+2348000000000',
        },
      });
      attendeeIds.push(attendee.id);
      await prisma.registration.create({
        data: {
          eventId,
          attendeeId: attendee.id,
          ticketProductId: products[category].id,
          formDataJson: form,
          status,
          ...(ticketStatus && {
            ticket: {
              create: {
                ticketCode: `T-${randomUUID()}`,
                qrSecret: randomUUID(),
                status: ticketStatus,
              },
            },
          }),
        },
      });
    }

    await prisma.speaker.createMany({
      data: [
        {
          eventId,
          name: 'Prof. Alaro',
          slug: `alaro-${suffix}`,
          role: 'Professor of Islamic Law',
          tag: 'Keynote Speaker',
        },
        {
          eventId,
          name: 'Hidden Speaker',
          slug: `hidden-${suffix}`,
          role: 'X',
          isActive: false,
        },
      ],
    });
    await prisma.sponsor.createMany({
      data: [
        { eventId, type: 'sponsor', name: 'Jaiz Bank' },
        { eventId, type: 'partner', name: 'Injaz Advisory' },
        { eventId, type: 'exhibitor', name: 'Some Exhibitor' },
      ],
    });
  }, 30000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: committeeIds } },
    });
    await prisma.committeeMember.deleteMany({ where: { eventId } });
    await prisma.committeePosition.deleteMany({ where: { eventId } });
    await prisma.ticket.deleteMany({ where: { registration: { eventId } } });
    await prisma.registration.deleteMany({ where: { eventId } });
    await prisma.attendee.deleteMany({ where: { id: { in: attendeeIds } } });
    await prisma.ticketProduct.deleteMany({ where: { eventId } });
    await prisma.speaker.deleteMany({ where: { eventId } });
    await prisma.sponsor.deleteMany({ where: { eventId } });
    const event = await prisma.event.delete({ where: { id: eventId } });
    await prisma.organization.delete({ where: { id: event.orgId } });
    await app.close();
  }, 60000);

  function api(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    token = organizerToken,
  ) {
    return request(httpServer)
      [method](`/admin/tags${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function getTags(): Promise<TagsBody> {
    const res = await api('get', `?event=${eventSlug}`);
    expect(res.status).toBe(200);
    return res.body as TagsBody;
  }

  it('forbids door staff', async () => {
    const res = await api('get', `?event=${eventSlug}`, doorStaffToken);
    expect(res.status).toBe(403);
  });

  it('includes only confirmed registrants, active speakers and sponsors/partners', async () => {
    const tags = await getTags();

    expect(tags.registrants).toEqual([
      expect.objectContaining({
        name: 'Amina Student',
        label: 'Student',
        title: 'UNILORIN',
      }),
      expect.objectContaining({
        name: 'Chidi Pro',
        label: 'Professional',
        title: 'CEO',
        organization: 'Stecs',
      }),
    ]);
    expect(tags.speakers.map((t) => [t.name, t.label])).toEqual([
      ['Prof. Alaro', 'Keynote Speaker'],
    ]);
    expect(tags.sponsors.map((t) => [t.name, t.label])).toEqual([
      ['Injaz Advisory', 'Partner'],
      ['Jaiz Bank', 'Sponsor'],
    ]);
  });

  it('reflects a corrected attendee name on the next load', async () => {
    const attendee = await prisma.attendee.findFirstOrThrow({
      where: { id: { in: attendeeIds }, fullName: 'Chidi Pro' },
    });
    await prisma.attendee.update({
      where: { id: attendee.id },
      data: { fullName: 'Chidi Okafor' },
    });

    const tags = await getTags();
    expect(tags.registrants.map((t) => t.name)).toContain('Chidi Okafor');
  });

  it('manages committee positions and members', async () => {
    const media = await api('post', '/positions').send({
      eventSlug,
      name: 'Media Team',
    });
    expect(media.status).toBe(201);
    const mediaId = (media.body as { id: string }).id;
    committeeIds.push(mediaId);

    const dupe = await api('post', '/positions').send({
      eventSlug,
      name: 'media team',
    });
    expect(dupe.status).toBe(409);

    const logistics = await api('post', '/positions').send({
      eventSlug,
      name: 'Logistics',
    });
    const logisticsId = (logistics.body as { id: string }).id;
    committeeIds.push(logisticsId);

    const member = await api('post', '/committee').send({
      eventSlug,
      fullName: '  Safiyah Bello ',
      positionId: mediaId,
    });
    expect(member.status).toBe(201);
    const memberId = (member.body as { id: string }).id;
    committeeIds.push(memberId);

    let tags = await getTags();
    expect(tags.committee).toEqual([
      expect.objectContaining({ name: 'Safiyah Bello', label: 'Media Team' }),
    ]);

    // A position that still has members can't be deleted.
    expect((await api('delete', `/positions/${mediaId}`)).status).toBe(400);

    const moved = await api('patch', `/committee/${memberId}`).send({
      positionId: logisticsId,
    });
    expect(moved.status).toBe(200);
    expect((await api('delete', `/positions/${mediaId}`)).status).toBe(200);

    const renamed = await api('patch', `/positions/${logisticsId}`).send({
      name: 'Logistics Team',
    });
    expect(renamed.status).toBe(200);
    tags = await getTags();
    expect(tags.committee[0].label).toBe('Logistics Team');

    expect((await api('delete', `/committee/${memberId}`)).status).toBe(200);
    tags = await getTags();
    expect(tags.committee).toEqual([]);
  });
});
