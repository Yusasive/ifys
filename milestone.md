# Milestones — IFY Summit Registration, Ticketing & Check-In System

Event: Islamic Finance Youth Summit 2026, Ilorin Innovation Hub — **7 Nov 2026** (fixed, non-negotiable).
Planning start: 1 Aug 2026 → ~14 weeks to event day.

Milestones follow the build order in TRD §12 / PRD §11, broken into shippable technical checkpoints per prompt.md's phasing. Dates are suggested pacing, not spec — adjust to actual team size/velocity, but keep the check-in path finished with margin before event day (prompt.md explicitly calls this the piece with the hardest deadline and highest cost of failure).

---

## M0 — Foundations (by 8 Aug 2026)
Scope: TRD §1–3.
- Repo scaffolding: Next.js + TS frontend, NestJS + TS backend, module boundaries stubbed (auth / registrations / payments / tickets / check-ins).
- PostgreSQL schema implemented per TRD §3; migrations in place.
- Redis provisioned (queue/cache); S3-compatible bucket provisioned for uploads, private with signed URL support.
- CI pipeline: typecheck (strict mode), lint, test runner wired up (empty suite is fine, pipeline must exist).
- **Exit criteria**: schema matches TRD §3 or documented deviations are written up; empty NestJS modules boot; frontend scaffold renders.

## M1 — Registration core, no money yet (by 22 Aug 2026)
Scope: TRD §12 step 1 / Phase 1 partial.
- Registration API: category selector → tier selector → dynamic per-category form (student / founder / professional field sets) → review, persisted as `draft`/`pending` only.
- Registration app UI implementing the design system's palette/type system and Standard/Premium visual distinction (design.md).
- Per-category form validation (TRD §11 priority 4) — tested.
- Student ID upload flow to private S3-compatible storage via signed URLs.
- **Exit criteria**: a user can complete the full registration form end-to-end and land in a `pending` state with no payment step yet.

## M2 — Payment & ticket issuance (by 12 Sep 2026)
Scope: TRD §6, §12 step 2 — the single most important invariant in the system.
- Paystack checkout integration, behind an interface that could later accommodate Flutterwave (TRD §2).
- Webhook endpoint: signature verification on every callback, idempotent handling of duplicate webhook fires.
- Ticket issuance triggered **only** by verified webhook — never by client-side redirect/"success" state.
- QR + short-code generation: opaque signed single-use tokens, single-use enforced as an atomic DB-level state transition (not app-level, to avoid races).
- Transactional ticket email: QR + short code + attendee/category/tier/event details, carrying the ticket-stub visual language from the registration app.
- Confirmation screen survives page refresh without re-issuing or duplicating a ticket.
- **Tests written before UI polish** (TRD §11 priorities 1–2): webhook idempotency + signature verification; concurrent single-use ticket enforcement under simultaneous scan/redemption attempts.
- **Exit criteria (= Phase 1 done, per prompt.md)**: an attendee can register, pay via Paystack, and receive a working ticket email with a scannable-in-principle QR and working short code — verified against a duplicate webhook and a confirmation-page refresh.

## M3 — Admin dashboard (by 3 Oct 2026)
Scope: TRD §9, §12 step 3 / Phase 2.
- Registrations table: paginated, filterable, searchable.
- Registration detail view: full submission, payment status, ticket state.
- Manual admin actions: mark-paid, resend ticket, void ticket.
- Audit log: every manual action that changes money or ticket state logged with who/what/when.
- CSV export of the full registrant list.
- Role-scoped access: door staff cannot reach organizer-only data or actions (TRD §11 priority 5) — tested.
- **Exit criteria (= Phase 2 done, per prompt.md)**: an organizer can find any registrant, see their full submission, correct a stuck payment, resend a ticket, and export the full list — with every action appearing in the audit log.

## M4 — Check-in PWA, online path (by 17 Oct 2026)
Scope: TRD §8 (online portion), §12 step 4a / Phase 3 start.
- Online scan flow (camera-based QR read) + manual short-code entry fallback.
- Check-in endpoint: rate-limited, role-scoped to door staff, single-use enforcement re-verified server-side at scan time.
- Unambiguous result states: valid/first-use, already-used, invalid/unknown code.
- **Exit criteria**: door staff can check someone in by scan or code and get a correct, unambiguous result, on a stable connection — before any offline logic is started (prompt.md: don't start Phase 3's offline logic before the online path is solid and tested).

## M5 — Check-in PWA, offline-first (by 31 Oct 2026)
Scope: TRD §8 (offline portion), §12 step 4b — hard deadline, highest cost-of-failure component.
- Offline queueing of scans when venue connectivity drops.
- Sync-on-reconnect with conflict resolution across multiple door stations (no double check-ins once back online) — tested (TRD §11 priority 3).
- Check-in result screen carries the ticket-stub visual language through from registration/email.
- Explicit, tested behavior for: two stations scanning the same code within the same second; connectivity dropping mid-event and recovering.
- **Exit criteria (= Phase 3 done, per prompt.md)**: door staff can check someone in by scan or by code, get an unambiguous result, and the system holds up through a connectivity drop/recovery mid-event with no double check-ins once back online.

## M6 — Event-day readiness (by 5 Nov 2026, 2 days before doors open)
Not a build phase — a go/no-go checkpoint.
- Full dry run of check-in PWA at venue network conditions if possible.
- Load/rate-limit check on public registration and check-in endpoints.
- Confirm HTTPS everywhere, hashed admin passwords, signed URLs on all upload access paths (TRD §10).
- Freeze non-critical changes; only fixes for event-day-blocking issues land after this point.
- **Exit criteria**: sign-off that M2–M5 exit criteria all still hold under a live rehearsal, door staff accounts provisioned and role-scoped, support contact live for the ticket email.

## Event day — 7 Nov 2026
System live for real check-in.

---

## Open items to raise with the user before/while building (per prompt.md's "ask, don't invent" list)
These are genuinely underspecified in the PRD/TRD and have real cost implications — flag rather than silently assume:
- Exact Premium tier perks.
- Refund policy.
- Exact short-code character set/length.
- Data retention period for attendee data after the event (including uploaded student IDs).
