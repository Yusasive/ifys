# Implementation Prompt — IFY Summit Registration, Ticketing & Check-In System

Use this as the task prompt for an AI coding agent (e.g. Claude Code) or a human engineer picking up the build. Attach `IFY-Summit-PRD.md`, `IFY-Summit-TRD.md`, and `IFY-Summit-UI-UX-Design-Prompt.md` alongside it — this prompt tells the engineer how to work, those three tell them what to build.

---

You are acting as the **principal software engineer** responsible for shipping the Islamic Finance Youth Summit 2026 registration, ticketing, and check-in system. The attached PRD, TRD, and UI/UX design prompt are your spec — treat them as authoritative, but you are expected to bring senior judgment to anything they underspecify, and to flag it rather than silently guess when a decision has real cost implications (payment handling, data retention, anything hard to reverse post-launch).

## Your mandate

Build a production-grade system, not a prototype — this handles real money and controls physical entry to a real event on a fixed date. Treat the following as non-negotiable, drawn directly from the TRD:

1. **A ticket is only ever issued after server-side payment confirmation.** No client-side "success" state may create a ticket. This is the single most important invariant in the system — if you find yourself tempted to issue a ticket from a redirect callback instead of a verified webhook, stop and re-read TRD §6.
2. **QR codes and short codes are opaque, signed, single-use tokens** — never raw attendee data, never valid for a second scan. Enforce single-use as an atomic database-level state transition, not application-level logic that can race.
3. **Every manual admin action that changes money or ticket state is audit-logged** (who, what, when).
4. **The check-in flow must survive a flaky venue connection** — offline queueing with sync-on-reconnect, not a hard failure.

If you ever have to trade one of these off for speed, say so explicitly rather than quietly shipping a weaker version.

## Scope and phasing

Build in the order the TRD lays out, and treat each phase as independently shippable:

1. **Phase 1** — Data model, registration API, and the registration app UI (extends the existing prototype: category selector, tier selector, dynamic form, review, Paystack checkout, webhook-driven ticket issuance, transactional ticket email with QR + short code).
2. **Phase 2** — Admin dashboard: registrations table (paginated, filterable, searchable), registration detail view, manual actions (mark-paid, resend, void), audit log, CSV export.
3. **Phase 3** — Check-in PWA: online scan + manual code entry first, then offline queueing and multi-station sync.

Do not start Phase 3's offline logic before Phase 3's online path is solid and tested — get the simple case right before layering in the hard case.

## Engineering standards

- **Stack**: follow TRD §2 (Next.js + TypeScript + Redux for frontend surfaces where state genuinely warrants it, NestJS + TypeScript backend, PostgreSQL, Redis for queue/cache, S3-compatible storage for uploads, Paystack as primary payment provider behind an interface that could later accommodate Flutterwave). Deviate only with a stated reason.
- **Data model**: implement TRD §3 as the source of truth; if you need to adjust it, explain the change against the spec rather than diverging silently.
- **Security defaults**: HTTPS everywhere, webhook signature verification on every Paystack callback, rate limiting on public endpoints and especially the check-in scan endpoint, private object storage with signed URLs for uploaded student IDs, hashed admin passwords, role-scoped access (door staff cannot reach organizer-only data or actions).
- **Testing priority** — mirror TRD §11 in this order: payment webhook idempotency and signature verification; concurrent single-use ticket enforcement; offline check-in sync conflict resolution; per-category form validation; admin role scoping. Write these before polishing UI details.
- **Design fidelity**: implement the UI/UX design prompt's palette, type system, and Standard/Premium tier distinction as specified — don't default back to generic component-library styling. The registration app's ticket-stub visual language should carry through to the confirmation screen, the ticket email, and the check-in result screen, since that visual continuity is what makes an attendee trust "this is my ticket" across surfaces.
- **Code quality**: TypeScript strict mode, clear module boundaries (auth / registrations / payments / tickets / check-ins as separate NestJS modules per TRD §4's API grouping), meaningful error messages on validation failures, no silent catch-and-ignore around payment or ticket-state code paths.

## Working method

- Work phase by phase. At the end of each phase, summarize what was built, what deviated from the spec and why, and what's explicitly deferred to the next phase.
- When the PRD/TRD is genuinely silent on something with real consequences (e.g. exact Premium tier perks, refund policy, exact short-code character set, data retention period for attendee data after the event) — ask, rather than inventing a business decision. Purely technical implementation details (naming, file structure, exact library choice within the stated stack) are yours to decide.
- Before marking payment or check-in code "done," walk through the failure modes explicitly: webhook fires twice, two door stations scan the same code within the same second, an attendee's payment succeeds but the confirmation page never loads, venue wifi drops mid-event. Each of these should have a defined, tested behavior — not just an untested assumption that it won't happen.
- Keep the door-day check-in path fast to build and test in isolation early — it's the one piece of this system with a hard, non-negotiable deadline (event day) and the highest cost of failure (a queue of attendees who can't get in).

## Definition of done (per phase)

- Phase 1: an attendee can register, pay via Paystack, and receive a working ticket email with a scannable-in-principle QR and a working short code — tested against a duplicate webhook and a page refresh on the confirmation screen.
- Phase 2: an organizer can find any registrant, see their full submission, correct a stuck payment, resend a ticket, and export the full list — with every one of those actions showing up in the audit log.
- Phase 3: door staff can check someone in by scan or by code, get an unambiguous result, and the system holds up if the station loses and regains connectivity mid-event, with no double check-ins once back online.