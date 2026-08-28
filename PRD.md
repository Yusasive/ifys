# Product Requirements Document (PRD)
## Islamic Finance Youth Summit 2026 — Registration, Ticketing & Check-In System

**Organizer:** NextIF
**Event:** Islamic Finance Youth Summit 2026 — "The Ethical Generation: Rethinking Finance & Innovation"
**Venue / Date:** Ilorin Innovation Hub, Multipurpose Hall — 5th November 2026
**Document owner:** Product/Engineering
**Status:** Draft v1.0

---

## 1. Overview

The summit needs a self-serve web application that lets an attendee choose a ticket, pay for it, and receive a verifiable e-ticket by email — plus an internal admin system that lets the organizing team see and manage everyone who has registered, and check people in on event day using a QR scanner or a manual short-code fallback.

This PRD covers three connected surfaces:

1. **Public registration & ticketing app** — the multi-step form already prototyped (ticket type → details → payment → confirmation).
2. **Admin dashboard** — internal tool for NextIF staff to manage registrations, payments, and the event-day registry.
3. **Check-in system** — a scanner-first, code-fallback tool used at the door on event day.

## 2. Goals

- Let an attendee register, pay, and receive a valid ticket in under 3 minutes on mobile.
- Guarantee that every issued ticket can be verified exactly once at the door — no shared screenshots, no double entry.
- Give the organizing team a single place to see who has registered, who has paid, and who has shown up, in real time.
- Make event-day check-in fast enough that a queue of 300+ attendees does not create a bottleneck at the door.

## 3. Non-goals (out of scope for v1)

- Seat assignment / reserved seating.
- Multi-event or multi-date ticketing (this build is scoped to a single one-day summit; the data model should not preclude adding this later).
- A native mobile app — the check-in scanner is a mobile-optimized web app (PWA), not an App Store submission.
- Public-facing landing page content/marketing site (tracked separately).

## 4. Users & personas

| Persona | Who | What they need |
|---|---|---|
| **Attendee** | Student, Founder/Entrepreneur, or Working Professional | Pick a ticket tier, fill the right form, pay, get a ticket they trust will work at the door |
| **Organizer / Admin** | NextIF team member | See registrations and payment status, search/filter attendees, export data, resend tickets, issue refunds/comps |
| **Door staff** | Volunteer or NextIF staff on event day | Scan a ticket or type a short code, get an instant valid/invalid signal, mark attendee as checked in |

## 5. Ticket structure

Two axes, both carried over from the existing brief and this conversation:

- **Category** (who the attendee is): Student, Founder/Entrepreneur, Working Professional — each with its own required fields (per the original brief).
- **Tier** (what they get / how much they pay): **Standard** and **Premium**. Premium should read as a visibly elevated experience (badge design, and any perk difference the organizer decides on — e.g. reserved-row seating, summit kit, or a founders' lounge access). The exact perk list is an organizer decision to be filled in before build; the system should treat tier as a configurable ticket product, not a hardcoded value, so pricing and perks can change without a code change.

## 6. Functional requirements

### 6.1 Public registration & ticketing app
- Ticket category selection (Student / Founder-Entrepreneur / Working Professional).
- Ticket tier selection (Standard / Premium) with price shown per category+tier combination.
- Dynamic form per category, matching the fields already specified in the original brief (student ID upload for students; org/role/industry + optional LinkedIn for founders and professionals).
- Inline validation (required fields, email format, phone format).
- Review step before payment.
- Payment step (see 6.2).
- Confirmation screen + "check your email" messaging.

### 6.2 Payment
- Card and bank transfer at minimum (Nigerian attendees expect both).
- Payment must be confirmed **server-side via webhook**, not just on the client redirect — a ticket is only marked "paid" once the payment provider confirms it independently. This is the single most important integrity rule in the system: a client-side "payment successful" screen is never sufficient on its own to issue a ticket.
- Idempotent handling — a webhook that fires twice, or a user who refreshes the confirmation page, must not create duplicate tickets or duplicate charges.
- Failed/abandoned payments should leave the registration in a "pending payment" state, retrievable by the attendee (e.g. resume via a link), and visible to admins as unpaid.

### 6.3 E-ticket delivery
- On successful payment, an email is sent to the attendee automatically containing:
  - A QR code that is unique per ticket and single-use at the door.
  - A **short code** (human-typeable, e.g. 6–8 characters) as a manual fallback when a QR won't scan or an attendee's phone is unavailable/dead.
  - Attendee name, ticket category, ticket tier, event date/venue.
  - A ticket ID for support reference.
- The email should also work as a printable ticket (attendees who prefer a printed copy).
- Resend capability — an admin (and ideally the attendee, via a "resend my ticket" link on a lookup page) can trigger a resend without generating a new/duplicate valid code.

### 6.4 Admin dashboard
- **Authentication**: admin accounts, not shared logins — at minimum organizer/admin and door-staff roles, since door staff only need check-in access, not full attendee data or refund controls.
- **Registrations table**: every registration with status (pending / paid / failed / refunded / checked-in), category, tier, submission timestamp, searchable and filterable (by category, tier, payment status, checked-in status) and sortable.
- **Registration detail view**: full form submission for one attendee, including their uploaded student ID (for student verification) and payment reference.
- **Manual actions**: mark as paid (for bank transfers reconciled manually, cash-at-door comps, etc.), resend ticket, void/cancel a ticket, issue a refund reference note.
- **Registry / check-in view**: real-time list of who has checked in, when, and by which door station — this is the event-day operations view, separate from the pre-event registrations table, though backed by the same records.
- **Export**: CSV export of the full registrant list and of the day-of attendance registry (organizers will want this for reporting and for the venue).
- **Basic counts dashboard**: total registrations, paid vs pending, breakdown by category and tier, checked-in count vs total — useful both before and during the event.

### 6.5 Check-in system
- **QR scanner**: camera-based scanning from a phone or tablet browser (PWA), works for multiple simultaneous door stations.
- **Manual short-code entry field**: a text input as a fallback for when scanning fails or an attendee only has the short code.
- Each scan/entry gives an immediate, unambiguous result: **Valid — first entry** (green), **Already used** (red, shows who/when it was first used), or **Not found / invalid** (red).
- Should work with intermittent venue wifi — see TRD for the offline-first requirement. A door station losing connectivity for a few minutes must not stop check-in entirely.
- Every check-in is logged with timestamp and station identifier, visible in the admin registry view in near-real-time once connectivity is available.

## 7. User flows (summary)

1. **Attendee**: Land on app → choose category → choose tier → fill form → review → pay → see confirmation → receive email with QR + short code.
2. **Admin (pre-event)**: Log in → view registrations → filter/search → resolve any pending/failed payments → export list as needed.
3. **Door staff (event day)**: Log in (scoped role) → open scanner → scan ticket or type short code → see valid/invalid result → attendee is marked checked-in.
4. **Admin (during event)**: Open registry/check-in dashboard → watch check-in count rise in real time → spot-check any "already used" disputes at the door via the registration detail view.

## 8. Non-functional requirements

- **Security & privacy**: student ID uploads and personal contact details are sensitive — access restricted to authorized admin roles, transmitted and stored encrypted, never exposed in the QR/short-code payload itself (see TRD §5).
- **Performance**: check-in scan result should return in under ~1 second on a reasonable venue connection, and the scanner UI itself should be usable even when that connection is poor.
- **Mobile-first**: the overwhelming majority of attendees will register and hold their ticket on a phone; the door scanner is a phone/tablet interface by design.
- **Accessibility**: form fields properly labeled, sufficient color contrast (relevant given the premium dark/gold visual direction — contrast needs to be checked, not assumed), keyboard-navigable admin dashboard.
- **Reliability on event day**: check-in must degrade gracefully (offline queueing) rather than fail outright if venue connectivity drops.

## 9. Assumptions

- Single event, single date, single venue — no multi-day or multi-track complexity in v1.
- NextIF will supply final pricing per category+tier combination and any tier-specific perks before build sign-off.
- Nigerian attendees are the primary audience; Paystack is assumed as the default payment processor (see TRD §6 for rationale), with card and bank transfer as the required methods.
- Email is the primary delivery channel for tickets (no SMS/WhatsApp delivery in v1, though the data model shouldn't block adding it later).

## 10. Risks

- **Screenshot/forwarding fraud**: mitigated by single-use, server-validated QR codes rather than static codes that scan valid from any copy (see TRD §5).
- **Venue connectivity on event day**: mitigated by offline-capable check-in with sync-on-reconnect.
- **Payment webhook reliability**: mitigated by idempotent webhook handling and a manual "mark as paid" admin override for edge cases (bank transfer proofs, etc.).
- **Door-day chaos with a single scanner**: the admin dashboard and check-in system should support multiple simultaneous check-in stations reading from the same shared registry, so a queue can be split across more than one entry point if needed.

## 11. Suggested phasing

1. **Phase 1**: Registration + payment + e-ticket email (QR + short code). This is the attendee-facing critical path.
2. **Phase 2**: Admin dashboard — registrations table, detail view, manual actions, export.
3. **Phase 3**: Check-in system — scanner, manual code entry, real-time registry view, offline mode.

Phases 2 and 3 can run in parallel once Phase 1's data model is settled, since both consume the same ticket records.