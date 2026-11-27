import { buildEmailDirectory } from './email-directory';

describe('buildEmailDirectory', () => {
  it('merges the same address across sources, ignoring case', () => {
    const rows = buildEmailDirectory(
      [
        {
          email: 'Ada@Example.com ',
          name: 'Ada Obi',
          phone: '0801',
          source: 'Attendee',
          seenAt: new Date('2026-09-02T00:00:00Z'),
        },
        {
          email: 'ada@example.com',
          source: 'Newsletter',
          seenAt: new Date('2026-08-01T00:00:00Z'),
        },
        { email: 'ada@example.com', source: 'Attendee' },
      ],
      [],
    );
    expect(rows).toEqual([
      {
        email: 'ada@example.com',
        name: 'Ada Obi',
        phone: '0801',
        sources: ['Attendee', 'Newsletter'],
        unsubscribed: false,
        firstSeenAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
  });

  it('skips blank emails, flags unsubscribes and sorts by email', () => {
    const rows = buildEmailDirectory(
      [
        { email: 'zed@example.com', source: 'Feedback' },
        { email: '  ', source: 'Feedback' },
        { email: 'bob@example.com', source: 'Volunteer' },
      ],
      ['ZED@example.com'],
    );
    expect(rows.map((r) => [r.email, r.unsubscribed])).toEqual([
      ['bob@example.com', false],
      ['zed@example.com', true],
    ]);
  });
});
