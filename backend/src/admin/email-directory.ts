export type EmailSource =
  | 'Attendee'
  | 'Newsletter'
  | 'Volunteer'
  | 'Sponsor applicant'
  | 'Feedback'
  | 'Staff';

export interface EmailContact {
  email: string;
  name?: string | null;
  phone?: string | null;
  source: EmailSource;
  seenAt?: Date | null;
}

export interface EmailDirectoryRow {
  email: string;
  name: string;
  phone: string;
  sources: EmailSource[];
  unsubscribed: boolean;
  firstSeenAt: string | null;
}

// One row per address (case-insensitive), with every place it appears.
export function buildEmailDirectory(
  contacts: EmailContact[],
  unsubscribed: Iterable<string>,
): EmailDirectoryRow[] {
  const optedOut = new Set(
    [...unsubscribed].map((e) => e.trim().toLowerCase()),
  );
  const byEmail = new Map<
    string,
    {
      name: string;
      phone: string;
      sources: Set<EmailSource>;
      first: Date | null;
    }
  >();

  for (const contact of contacts) {
    const email = contact.email?.trim().toLowerCase();
    if (!email) continue;
    const entry = byEmail.get(email) ?? {
      name: '',
      phone: '',
      sources: new Set<EmailSource>(),
      first: null,
    };
    if (!entry.name && contact.name?.trim()) entry.name = contact.name.trim();
    if (!entry.phone && contact.phone?.trim())
      entry.phone = contact.phone.trim();
    entry.sources.add(contact.source);
    if (contact.seenAt && (!entry.first || contact.seenAt < entry.first)) {
      entry.first = contact.seenAt;
    }
    byEmail.set(email, entry);
  }

  return [...byEmail.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([email, entry]) => ({
      email,
      name: entry.name,
      phone: entry.phone,
      sources: [...entry.sources],
      unsubscribed: optedOut.has(email),
      firstSeenAt: entry.first ? entry.first.toISOString() : null,
    }));
}
