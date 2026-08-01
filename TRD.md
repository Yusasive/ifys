# Technical Requirements Document (TRD)
## Islamic Finance Youth Summit 2026 — Registration, Ticketing & Check-In System

**Companion to:** IFY-Summit-PRD.md
**Status:** Draft v1.0

---

## 1. Architecture overview

Three consumers, one backend and one source of truth for ticket state:

```
                         ┌────────────────────────┐
   Attendee (browser) ───▶  Registration + Payment  │
                         │  web app (public)        │
                         └───────────┬──────────────┘
                                     │ REST/JSON
                                     ▼
                         ┌────────────────────────┐
                         │      API / Backend       │
                         │  (auth, tickets, orders,  │
                         │   payments, check-ins)    │
                         └───────────┬──────────────┘
                     ┌───────────────┼───────────────┐
                     ▼               ▼               ▼
             ┌──────────────┐ ┌────────────┐ ┌────────────────┐
             │  Database     │ │ Payment     │ │ Transactional    │
             │  (Postgres)   │ │ provider    │ │ email provider   │
             │               │ │ (Paystack)  │ │ (ticket delivery) │
             └──────────────┘ └────────────┘ └────────────────┘
                     ▲
                     │
        ┌────────────┴─────────────┐
        ▼                          ▼
┌───────────────────┐   ┌───────────────────────┐
│  Admin dashboard    │   │  Check-in PWA          │
│  (web, role-gated)  │   │  (scanner + short-code) │
└───────────────────┘   └───────────────────────┘
```

Everything reads and writes through one API and one database. The check-in PWA additionally keeps a local offline queue (see §8).

## 2. Recommended stack

Chosen to match your existing stack and keep the surface area small:

- **Frontend (registration app, admin dashboard, check-in PWA)**: Next.js + TypeScript + Redux (where state is genuinely shared/complex — the registration wizard and check-in queue are the two places this matters).
- **Backend**: NestJS (TypeScript) — consistent with your existing stack, good fit for the modular structure below (auth module, tickets module, payments module, check-ins module).
- **Database**: PostgreSQL. Relational integrity matters a lot here (a ticket must belong to exactly one order, a check-in must reference exactly one ticket) — this is not a good fit for a schemaless store.
- **Cache/queue**: Redis — used for (a) rate-limiting the public API, (b) a lightweight job queue for sending ticket emails and generating QR/PDF assets without blocking the payment webhook response.
- **File storage**: S3-compatible object storage for uploaded student ID images/PDFs, never stored directly in the database.
- **Hosting**: containerized (Docker), deployable to any standard cloud (AWS/Render/Fly.io) — matches your existing AWS/Docker experience.
- **Payment provider**: **Paystack** as primary. Search-grounded rationale: Paystack remains the standard default for single-market, Nigeria-focused, card-and-transfer businesses in 2026 — strongest local developer experience and plugin ecosystem, daily settlement, transaction fees around 1.5% locally (capped). Flutterwave is the better fit only if you expect meaningful cross-border ticket sales; keep the payment integration behind an internal interface so a second provider (Flutterwave, as a fallback or for international attendees) can be added later without touching the rest of the system.

## 3. Data model

Core tables (simplified — exact columns per category are flexible JSON where the schema genuinely varies):

```
organizations            -- future-proofing if NextIF runs more than one event later
  id, name

events
  id, org_id, name, venue, starts_at, slug

ticket_products           -- the sellable combination of category × tier
  id, event_id, category (student|founder|professional), tier (standard|premium),
  price_kobo, currency, perks_json, is_active

attendees
  id, full_name, email, phone

registrations              -- one per attendee per event; holds category-specific answers
  id, event_id, attendee_id, ticket_product_id,
  form_data_json,           -- institution/startup name/role/industry/linkedin etc.
  student_id_file_url,      -- nullable, only for student category
  status (draft|pending_payment|paid|failed|refunded|cancelled),
  created_at

orders
  id, registration_id, amount_kobo, currency,
  provider (paystack), provider_reference, status, paid_at

tickets                    -- issued only once an order is confirmed paid
  id, registration_id, ticket_code (short code, e.g. 8 chars),
  qr_secret (opaque signed token, see §5), status (unused|used|void),
  issued_at

check_ins
  id, ticket_id, station_id, checked_in_at, checked_in_by (admin/door user id),
  method (qr|manual_code)

admin_users
  id, name, email, password_hash, role (organizer|door_staff), created_at

audit_log
  id, actor_id, action, target_type, target_id, created_at, metadata_json
```

Notes:
- `registrations.status` and `orders.status` are kept separate from `tickets` deliberately: a **ticket only exists once payment is confirmed**. This means "has this person paid" and "is this a valid ticket to scan" are never the same lookup, which is exactly the property you want for fraud resistance.
- `form_data_json` keeps category-specific fields flexible (LinkedIn, industry, institution, etc.) without a rigid columns-per-category schema, while `ticket_product_id`, `status`, and payment fields stay strongly typed since those drive business logic.

## 4. API surface (representative, not exhaustive)

**Public**
- `POST /registrations` — create a draft registration with category + form data.
- `POST /registrations/:id/checkout` — create a Paystack transaction, return the payment redirect/reference.
- `GET /registrations/:id` — status lookup (for the "resume payment" / confirmation page).
- `POST /webhooks/paystack` — signature-verified webhook; the only place an order/ticket ever flips to `paid`/issued.

**Admin (authenticated, role-gated)**
- `GET /admin/registrations` — paginated, filterable, searchable.
- `GET /admin/registrations/:id` — full detail incl. uploaded ID.
- `POST /admin/registrations/:id/mark-paid` — manual override, audit-logged.
- `POST /admin/registrations/:id/resend-ticket`
- `POST /admin/registrations/:id/void`
- `GET /admin/registry` — check-in view (checked-in vs not, live counts).
- `GET /admin/export` — CSV export.

**Check-in (authenticated as door_staff or organizer)**
- `POST /checkin/scan` — body: `{ qr_token }` or `{ short_code }`; returns `valid_first_use | already_used | not_found`, plus attendee name/category/tier for the door screen.
- `GET /checkin/status` — live counts for the station.

## 5. QR code & short-code design — the fraud-prevention core

This is the part worth getting right, because it's what a screenshot-forwarding attempt actually has to defeat. Search-grounded 2026 practice converges on one point: **the security is in server-side, one-time validation of a signed token — not in the QR image itself.**

- **Never encode raw attendee data in the QR.** The QR encodes an opaque, signed token (e.g. a JWT-like structure or an HMAC-signed random ID), not the attendee's name, email, or ticket ID in plaintext. A screenshot of the QR is just a screenshot of an opaque code — it carries no personal data on its own, and the point of validity is the server record, not the code's contents.
- **Dynamic, not static.** The token references a server-side ticket record rather than encoding everything the door needs directly. This is what lets you flip `tickets.status` to `used` at first scan and reject every subsequent scan of the same code, which is the single biggest lever against duplicated/forwarded tickets — industry reporting on 2026 dynamic-QR deployments shows this kind of real-time single-use validation cutting duplicate-entry fraud dramatically versus static codes.
- **Short code is a separate, independently-valid credential**, not a decoded version of the QR — an 6–8 character code (excluding ambiguous characters like 0/O, 1/I) tied to the same `tickets` row, so door staff can type it in when a scan fails, a phone is dead, or an attendee only printed the text portion of the email.
- **Single-use enforcement lives at the database layer** (a status transition guarded by a unique/atomic update — `used` can only be set once, and a race between two door stations scanning the same code near-simultaneously must resolve to exactly one success), not just in application logic.
- **Rate limiting** on the scan endpoint to prevent brute-forcing short codes.
- Keep the door's "already used" response informative for staff (who/when it was first used) so they can make a judgment call on a genuine dispute, without exposing that detail to the public.

## 6. Payment integration detail

- Initialize the Paystack transaction server-side (never trust a client-supplied amount).
- On the client, redirect to Paystack's hosted checkout (fastest to ship, PCI scope stays with Paystack).
- **Webhook-driven confirmation is mandatory**: the `POST /webhooks/paystack` handler verifies Paystack's signature, then — and only then — marks the order paid and issues the ticket (generates `ticket_code` + `qr_secret`, queues the confirmation email). The client-side "payment successful" redirect is purely cosmetic; it should poll the registration status rather than assume success.
- Handle webhook retries idempotently — a webhook firing twice for the same event must not issue two tickets or send two emails (guard on `provider_reference` uniqueness).
- Reconciliation path for bank transfers or comps: an admin "mark as paid" action follows the exact same issue-ticket code path as the webhook, so there is one single function that creates a ticket, not two divergent implementations.

## 7. Ticket email

- Sent via a transactional email provider (not the app's own SMTP) for deliverability.
- Content: attendee name, category, tier, event date/venue, the QR image (generated server-side as an SVG/PNG embedded or attached), the short code in large monospace text, and a support contact.
- Optionally attach a print-ready PDF ticket (same visual as the on-screen ticket stub from the registration app) — useful for attendees without reliable phone access at the door.
- Resending must reuse the existing `ticket_code`/`qr_secret` rather than minting a new one, so an old printed copy and a resent copy both remain valid for the same single use.

## 8. Check-in system — offline-first requirement

Venue wifi at a one-day event is not something to trust fully. Recommended pattern, matching 2026 industry practice (e.g. offline modes seen in tools like Cvent OnArrival):

- The check-in PWA pre-downloads a **local, hashed lookup index** of valid ticket tokens/short codes when a station comes online at the start of the day (not full attendee PII — just enough to validate offline and flag "already used locally").
- Scans while offline are queued locally with a timestamp, shown to staff as "recorded — will sync," and synced to the server the moment connectivity returns.
- Conflict rule on sync: **first server-confirmed timestamp wins** if two offline stations scanned the same ticket while both disconnected; the second is flagged for manual review rather than silently rejected or silently accepted.
- Multiple simultaneous stations read/write the same shared registry once online, so splitting the queue across two or three doors is safe.

## 9. Admin dashboard technical notes

- Authenticated, role-gated (`organizer` full access; `door_staff` scoped to the check-in module only — should not see uploaded student IDs or full registration detail).
- Registrations table should support server-side pagination and filtering from day one — a single flat CSV-style table won't hold up once registrations are in the hundreds.
- All manual state changes (`mark-paid`, `void`, `resend`) write to `audit_log` with actor and timestamp — this is what lets you answer "who marked this as paid and when" during event-week troubleshooting.
- CSV export should be a background job for anything beyond a trivial row count, not a synchronous request.

## 10. Security & privacy

- Student ID uploads: stored in private object storage, access via short-lived signed URLs only from the admin detail view, never public.
- Personal data (email, phone, uploaded ID) is not embedded in the QR/short-code payload (§5) and is not exposed via the check-in scan response beyond the attendee's display name and ticket category — door staff don't need to see an attendee's email/phone to check them in.
- Passwords hashed (bcrypt/argon2) for admin accounts; consider short-lived sessions plus a re-auth step for destructive actions (void, refund).
- HTTPS everywhere; webhook endpoint verifies Paystack's signature on every request.
- Rate limiting on public endpoints (registration creation, checkout, and especially the check-in scan endpoint).

## 11. Testing priorities

Given where the actual risk is, prioritize test coverage in this order:
1. Payment webhook idempotency and signature verification.
2. Single-use ticket enforcement under concurrent/simultaneous scan attempts.
3. Offline check-in queue + sync conflict resolution.
4. Registration form validation per category (student vs founder vs professional field sets).
5. Admin role scoping (door staff genuinely cannot reach organizer-only endpoints).

## 12. Suggested build order

Mirrors the PRD's phasing, broken into technical milestones:

1. Data model + registration API + registration app UI (no payment yet — draft/pending only).
2. Paystack checkout + webhook + ticket issuance + email delivery.
3. Admin dashboard: registrations table, detail view, manual actions, audit log.
4. Check-in PWA: online-only scan + manual code first, then layer in offline queueing once the online path is solid.