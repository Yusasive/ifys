import { AnalyticsRegistration, computeAnalytics } from './admin-analytics';

const NOW = new Date('2026-11-05T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

function row(
  overrides: Partial<AnalyticsRegistration> = {},
): AnalyticsRegistration {
  return {
    createdAt: hoursAgo(1),
    status: 'pending_payment',
    heardFrom: null,
    state: null,
    gender: null,
    ageRange: null,
    industry: null,
    utmSource: null,
    utmCampaign: null,
    discountAppliedKobo: 0,
    pendingPaymentReminderSentAt: null,
    attendee: { email: 'a@gmail.com' },
    ticketProduct: { category: 'regular', tier: 'standard' },
    coupon: null,
    order: null,
    ticket: null,
    ...overrides,
  };
}

function paid(overrides: Partial<AnalyticsRegistration> = {}) {
  return row({
    status: 'paid',
    order: { status: 'paid', amountMinor: 500_000, paymentChannel: 'card' },
    ticket: { status: 'unused', checkIns: [] },
    ...overrides,
  });
}

describe('computeAnalytics', () => {
  it('counts the funnel and conversion', () => {
    const result = computeAnalytics(
      [paid(), paid(), row(), row({ status: 'cancelled' })],
      NOW,
    );
    expect(result.funnel).toMatchObject({
      registered: 4,
      paid: 2,
      pendingPayment: 1,
      failedOrCancelled: 1,
      conversionRate: 50,
    });
  });

  it('adds up revenue, discounts, products, channels and coupons', () => {
    const result = computeAnalytics(
      [
        paid({ coupon: { code: 'EARLY' }, discountAppliedKobo: 100_000 }),
        paid({
          ticketProduct: { category: 'student', tier: 'standard' },
          order: {
            status: 'paid',
            amountMinor: 200_000,
            paymentChannel: 'bank_transfer',
          },
        }),
      ],
      NOW,
    );
    expect(result.revenue.totalMinor).toBe(700_000);
    expect(result.revenue.discountMinor).toBe(100_000);
    expect(result.revenue.byChannel.map((c) => c.channel)).toEqual([
      'card',
      'bank_transfer',
    ]);
    expect(result.revenue.byProduct[0]).toMatchObject({
      category: 'regular',
      amountMinor: 500_000,
    });
    expect(result.coupons).toEqual([
      { code: 'EARLY', count: 1, discountMinor: 100_000 },
    ]);
  });

  it('ages pending payments and counts who can be reminded', () => {
    const result = computeAnalytics(
      [
        row({ createdAt: hoursAgo(2) }),
        row({ createdAt: hoursAgo(30) }),
        row({
          createdAt: hoursAgo(30),
          pendingPaymentReminderSentAt: hoursAgo(3),
        }),
        row({ createdAt: hoursAgo(100) }),
      ],
      NOW,
    );
    expect(result.pending).toEqual({
      count: 4,
      under24h: 1,
      between1And3Days: 2,
      over3Days: 1,
      remindable: 2,
    });
  });

  it('groups answers case-insensitively and keeps "Not provided" last', () => {
    const result = computeAnalytics(
      [
        paid({ heardFrom: 'Instagram' }),
        row({ heardFrom: 'instagram ' }),
        paid({ heardFrom: 'WhatsApp' }),
        row(),
      ],
      NOW,
    );
    expect(result.breakdowns.source).toEqual([
      { label: 'Instagram', count: 2, paid: 1 },
      { label: 'Whatsapp', count: 1, paid: 1 },
      { label: 'Not provided', count: 1, paid: 0 },
    ]);
  });

  it('reports check-in rate, hourly arrivals, doors and no-shows', () => {
    const checkedIn = (at: string, station: string) =>
      paid({
        ticket: {
          status: 'used',
          checkIns: [{ checkedInAt: new Date(at), stationId: station }],
        },
      });
    const result = computeAnalytics(
      [
        checkedIn('2026-11-05T08:10:00Z', 'door-1'), // 09:10 Lagos
        checkedIn('2026-11-05T08:50:00Z', 'door-1'),
        checkedIn('2026-11-05T09:05:00Z', 'door-2'), // 10:05 Lagos
        paid(),
      ],
      NOW,
    );
    expect(result.eventDay.checkInRate).toBe(75);
    expect(result.eventDay.arrivalsByHour).toEqual([
      { hour: '2026-11-05 09:00', count: 2 },
      { hour: '2026-11-05 10:00', count: 1 },
    ]);
    expect(result.eventDay.byStation[0]).toEqual({
      station: 'door-1',
      count: 2,
    });
    expect(result.eventDay.noShowByCategory[0]).toMatchObject({
      tickets: 4,
      checkedIn: 3,
      noShow: 1,
    });
  });

  it('buckets days in Lagos time and flags shared company domains', () => {
    const company = (n: number) =>
      Array.from({ length: n }, () =>
        row({ attendee: { email: 'x@acme.ng' } }),
      );
    const result = computeAnalytics(
      [
        row({ createdAt: new Date('2026-11-04T23:30:00Z') }),
        ...company(5),
        ...company(0),
      ],
      NOW,
    );
    // 23:30 UTC is already the 5th in Nigeria (UTC+1).
    expect(result.daily[0].date).toBe('2026-11-05');
    expect(result.flags.sharedEmailDomains).toEqual([
      { domain: 'acme.ng', count: 5 },
    ]);
  });
});
