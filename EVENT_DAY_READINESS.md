# Event-Day Readiness — M6 Go/No-Go Checklist

Per `milestone.md` M6. Not a build phase — a sign-off checkpoint for the
Islamic Finance Youth Summit 2026, 7 Nov 2026. Run this fully **by 5 Nov
2026** (2 days before doors open) against the real production deployment,
not just this local dev environment.

## Code-verified (done as of this pass)

- [x] **Rate limiting**: global default raised to 300 req/min per IP
      (was 60 — a burst-load test showed 60/min throttling legitimate
      concurrent registrations from a shared IP, e.g. campus/office
      WiFi NAT, which is realistic for this audience). `/checkin/scan`
      keeps its own stricter 20/min override — that limit exists to
      blunt short-code brute-forcing, not to manage load, so it stays
      tight regardless of overall traffic tuning.
      Verified: 150 concurrent registration-flow requests all succeeded
      post-fix; a 25-request burst against `/checkin/scan` still gets
      exactly 20×`201` then `429`s.
- [x] **Hashed admin passwords**: bcrypt (cost 10), verified via login
      tests and the void-ticket re-auth flow.
- [x] **Signed URLs on all upload access paths**: student ID upload
      (signed PUT), admin student-ID view (signed GET), CSV export
      download (signed GET) — all short-lived (15 min), generated fresh
      per request, never stored or exposed as a long-lived link.
- [x] **Security headers**: `helmet()` applied globally (CSP, HSTS,
      X-Frame-Options, etc.) — verified via `curl -I`.
- [x] **Support contact wired into the ticket email**: `SUPPORT_EMAIL`
      is now a required env var (`getOrThrow`, no silent fallback) — the
      app fails fast if it's unset rather than shipping a placeholder
      nobody reads.
- [x] **Door staff account provisioning**: organizers can now create
      real `door_staff`/`organizer` accounts from `/admin/users`
      (previously this required editing `prisma/seed.ts` and
      redeploying) — audit-logged like every other admin action.
- [x] **Full online + offline check-in dry run**: exercised live in M4/
      M5 — valid scan, duplicate, not-found, void, and the two-station
      offline conflict scenario (verified via CDP network emulation)
      all resolve correctly with no double check-ins.

## Requires action before go-live (not something code can verify)

- [ ] **`SUPPORT_EMAIL` must be a real, monitored inbox.** The current
      value (`support@ifysummit.ng`) is a placeholder used for local
      dev/CI — confirm the real address before the first ticket email
      goes out, since the app will now refuse to boot without this set,
      but won't refuse an unmonitored real-looking address.
- [ ] **HTTPS in production.** This app has no TLS termination built in
      — it expects to sit behind a reverse proxy / platform load
      balancer (e.g. Render, Fly.io, an nginx/Caddy in front of it) that
      terminates HTTPS and forwards `X-Forwarded-*` headers. `trust
      proxy` is already set in `main.ts` for this. Confirm whatever
      hosting is chosen actually enforces HTTPS end-to-end before event
      day — this wasn't testable in local dev (plain HTTP).
- [ ] **Real door-staff accounts provisioned**, not the seeded dev
      accounts (`organizer@ifysummit.ng` / `doorstaff@ifysummit.ng` —
      these use published dev-only passwords and must not be relied on
      for the real event). Use `/admin/users` to create real accounts
      with strong, unique passwords for each door station/volunteer.
- [ ] **Full dry run at the actual venue**, on the actual venue network,
      with the actual devices staff will use on the day. Everything
      above was verified in local dev (localhost, wired network, no
      real venue WiFi congestion) — venue conditions are the one thing
      that can't be simulated from here.
- [ ] **Pricing and Premium perks finalized.** `prisma/seed.ts` still
      seeds placeholder prices (flagged since M1) — confirm NextIF's
      final numbers are in before the event, not the placeholders.
- [ ] **Refund policy and data retention period** — flagged as open
      items since `milestone.md`, still unresolved. Needed before any
      refund is actually issued or attendee data is deleted post-event.
- [ ] **Change freeze.** Per the milestone: once this checklist is
      signed off, only fixes for event-day-blocking issues should land.
      This is a process decision for the team, not something this
      document can enforce.

## How to re-run the checks that matter

```bash
# Rate limiting still holds after any future change:
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code} " \
  -X POST http://localhost:3000/checkin/scan \
  -H "Authorization: Bearer $DOOR_TOKEN" -H "Content-Type: application/json" \
  -d '{"shortCode":"ZZZZZZ","stationId":"recheck"}'; done
# Expect: 201 x20, then 429 x5

# Security headers present:
curl -I http://localhost:3000/ | grep -i "content-security-policy\|strict-transport"

# Full test suite (69 tests as of this pass):
npm run test
```
