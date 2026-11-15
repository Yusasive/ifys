const TIME_ZONE = 'Africa/Lagos';
const NOT_PROVIDED = 'Not provided';
const BREAKDOWN_LIMIT = 12;
const PENDING_REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;
const SHARED_DOMAIN_MIN = 5;

// Everyone shares these, so many sign-ups from them mean nothing.
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'mail.com',
  'zoho.com',
]);

export interface AnalyticsRegistration {
  createdAt: Date;
  status: string;
  heardFrom: string | null;
  state: string | null;
  gender: string | null;
  ageRange: string | null;
  industry: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  discountAppliedKobo: number;
  pendingPaymentReminderSentAt: Date | null;
  attendee: { email: string };
  ticketProduct: { category: string; tier: string };
  coupon: { code: string } | null;
  order: {
    status: string;
    amountMinor: number;
    paymentChannel: string | null;
  } | null;
  ticket: {
    status: string;
    checkIns: { checkedInAt: Date; stationId: string }[];
  } | null;
}

export interface BreakdownItem {
  label: string;
  // Everyone who registered (pending and paid), and how many of them paid.
  count: number;
  paid: number;
}

function dateKey(date: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function hourKey(date: Date): string {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${dateKey(date)} ${hour}:00`;
}

// "Lagos " and "lagos" are the same answer.
function normalise(value: string | null): string {
  if (!value) return NOT_PROVIDED;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return NOT_PROVIDED;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function breakdown(
  rows: AnalyticsRegistration[],
  pick: (row: AnalyticsRegistration) => string,
): BreakdownItem[] {
  const groups = new Map<string, BreakdownItem>();
  for (const row of rows) {
    const label = pick(row);
    const item = groups.get(label) ?? { label, count: 0, paid: 0 };
    item.count += 1;
    if (row.status === 'paid') item.paid += 1;
    groups.set(label, item);
  }
  const sorted = [...groups.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
  // "Not provided" stays visible but never pushes a real answer off the list.
  const real = sorted.filter((i) => i.label !== NOT_PROVIDED);
  const missing = sorted.filter((i) => i.label === NOT_PROVIDED);
  const top = real.slice(0, BREAKDOWN_LIMIT);
  const rest = real.slice(BREAKDOWN_LIMIT);
  if (rest.length > 0) {
    top.push({
      label: 'Other',
      count: rest.reduce((n, i) => n + i.count, 0),
      paid: rest.reduce((n, i) => n + i.paid, 0),
    });
  }
  return [...top, ...missing];
}

function tally<T>(map: Map<string, T>, key: string, make: () => T): T {
  let entry = map.get(key);
  if (!entry) {
    entry = make();
    map.set(key, entry);
  }
  return entry;
}

export function computeAnalytics(
  rows: AnalyticsRegistration[],
  now = new Date(),
) {
  const count = (status: string) =>
    rows.filter((r) => r.status === status).length;
  const paidRows = rows.filter((r) => r.status === 'paid');
  const pendingRows = rows.filter((r) => r.status === 'pending_payment');

  // Registrations still in play. Cancelled / failed / refunded and abandoned
  // drafts would only muddy the breakdowns.
  const live = rows.filter((r) =>
    ['paid', 'pending_payment', 'pending_review'].includes(r.status),
  );

  // --- Registrations per day ---
  const days = new Map<
    string,
    { date: string; total: number; paid: number; pending: number }
  >();
  for (const row of rows) {
    const key = dateKey(row.createdAt);
    const day = tally(days, key, () => ({
      date: key,
      total: 0,
      paid: 0,
      pending: 0,
    }));
    day.total += 1;
    if (row.status === 'paid') day.paid += 1;
    else if (row.status === 'pending_payment') day.pending += 1;
  }
  const daily = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));

  // --- Revenue ---
  const paidOrders = rows.filter((r) => r.order?.status === 'paid');
  const revenueByProduct = new Map<
    string,
    { category: string; tier: string; count: number; amountMinor: number }
  >();
  const revenueByChannel = new Map<
    string,
    { channel: string; count: number; amountMinor: number }
  >();
  const couponUse = new Map<
    string,
    { code: string; count: number; discountMinor: number }
  >();
  let totalMinor = 0;
  let discountMinor = 0;
  for (const row of paidOrders) {
    const amount = row.order!.amountMinor;
    totalMinor += amount;
    discountMinor += row.discountAppliedKobo;

    const { category, tier } = row.ticketProduct;
    const product = tally(revenueByProduct, `${category}/${tier}`, () => ({
      category,
      tier,
      count: 0,
      amountMinor: 0,
    }));
    product.count += 1;
    product.amountMinor += amount;

    const channel = row.order!.paymentChannel ?? 'unknown';
    const byChannel = tally(revenueByChannel, channel, () => ({
      channel,
      count: 0,
      amountMinor: 0,
    }));
    byChannel.count += 1;
    byChannel.amountMinor += amount;

    if (row.coupon) {
      const coupon = tally(couponUse, row.coupon.code, () => ({
        code: row.coupon!.code,
        count: 0,
        discountMinor: 0,
      }));
      coupon.count += 1;
      coupon.discountMinor += row.discountAppliedKobo;
    }
  }

  // --- Pending payments, by how long they have waited ---
  const waited = pendingRows.map((r) => now.getTime() - r.createdAt.getTime());
  const hours = (n: number) => n * 60 * 60 * 1000;
  const remindable = pendingRows.filter(
    (r, i) =>
      waited[i] >= hours(24) &&
      (!r.pendingPaymentReminderSentAt ||
        now.getTime() - r.pendingPaymentReminderSentAt.getTime() >=
          PENDING_REMINDER_AFTER_MS),
  ).length;

  // --- Event day ---
  const paidTickets = rows.filter(
    (r) => r.ticket && r.ticket.status !== 'void',
  );
  const checkedInRows = paidTickets.filter((r) => r.ticket!.status === 'used');
  const arrivals = new Map<string, { hour: string; count: number }>();
  const stations = new Map<string, { station: string; count: number }>();
  for (const row of checkedInRows) {
    const first = [...row.ticket!.checkIns].sort(
      (a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime(),
    )[0];
    if (!first) continue;
    const hour = hourKey(first.checkedInAt);
    tally(arrivals, hour, () => ({ hour, count: 0 })).count += 1;
    tally(stations, first.stationId, () => ({
      station: first.stationId,
      count: 0,
    })).count += 1;
  }
  const noShows = new Map<
    string,
    { category: string; tickets: number; checkedIn: number }
  >();
  for (const row of paidTickets) {
    const category = row.ticketProduct.category;
    const entry = tally(noShows, category, () => ({
      category,
      tickets: 0,
      checkedIn: 0,
    }));
    entry.tickets += 1;
    if (row.ticket!.status === 'used') entry.checkedIn += 1;
  }

  // --- Unusual patterns ---
  const domains = new Map<string, { domain: string; count: number }>();
  for (const row of live) {
    const domain = row.attendee.email.split('@')[1]?.toLowerCase();
    if (!domain || FREE_EMAIL_DOMAINS.has(domain)) continue;
    tally(domains, domain, () => ({ domain, count: 0 })).count += 1;
  }

  const rate = (part: number, whole: number) =>
    whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

  return {
    asOf: now.toISOString(),
    timeZone: TIME_ZONE,
    funnel: {
      registered: rows.length,
      paid: paidRows.length,
      pendingPayment: pendingRows.length,
      pendingReview: count('pending_review'),
      failedOrCancelled:
        count('failed') + count('cancelled') + count('refunded'),
      // Of everyone who started, how many paid.
      conversionRate: rate(paidRows.length, rows.length),
    },
    pending: {
      count: pendingRows.length,
      under24h: waited.filter((w) => w < hours(24)).length,
      between1And3Days: waited.filter((w) => w >= hours(24) && w < hours(72))
        .length,
      over3Days: waited.filter((w) => w >= hours(72)).length,
      // Over 24h waiting and not reminded in the last 24h.
      remindable,
    },
    daily,
    revenue: {
      currency: 'NGN',
      totalMinor,
      discountMinor,
      byProduct: [...revenueByProduct.values()].sort(
        (a, b) => b.amountMinor - a.amountMinor,
      ),
      byChannel: [...revenueByChannel.values()].sort(
        (a, b) => b.amountMinor - a.amountMinor,
      ),
    },
    coupons: [...couponUse.values()].sort((a, b) => b.count - a.count),
    breakdowns: {
      category: breakdown(live, (r) => r.ticketProduct.category),
      tier: breakdown(live, (r) => r.ticketProduct.tier),
      industry: breakdown(live, (r) => normalise(r.industry)),
      source: breakdown(live, (r) => normalise(r.heardFrom)),
      campaign: breakdown(live, (r) => normalise(r.utmCampaign ?? r.utmSource)),
      state: breakdown(live, (r) => normalise(r.state)),
      gender: breakdown(live, (r) => normalise(r.gender)),
      ageRange: breakdown(live, (r) => normalise(r.ageRange)),
    },
    eventDay: {
      tickets: paidTickets.length,
      checkedIn: checkedInRows.length,
      checkInRate: rate(checkedInRows.length, paidTickets.length),
      arrivalsByHour: [...arrivals.values()].sort((a, b) =>
        a.hour.localeCompare(b.hour),
      ),
      byStation: [...stations.values()].sort((a, b) => b.count - a.count),
      noShowByCategory: [...noShows.values()].map((e) => ({
        ...e,
        noShow: e.tickets - e.checkedIn,
      })),
    },
    flags: {
      sharedEmailDomains: [...domains.values()]
        .filter((d) => d.count >= SHARED_DOMAIN_MIN)
        .sort((a, b) => b.count - a.count),
    },
  };
}
