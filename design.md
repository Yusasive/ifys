# UI/UX Design Prompt
## Islamic Finance Youth Summit 2026 — Design System & Screen Prompts

Use this as a brief for a designer, or as a prompt for AI-assisted design generation. It defines one coherent design system with two tiers (Standard, Premium), then gives per-screen prompts for every surface in the PRD/TRD.

---

## 1. Design philosophy

The summit sits at the intersection of two worlds: **Islamic finance's ethical, values-first tradition**, and **a youth-facing, modern innovation event**. The design should feel like a well-made object — a boarding pass, a minted coin, a ledger — rather than a generic conference template. Draw from Islamic geometric art (interlacing line work, eight-point stars/khatam patterns, arch silhouettes, muqarnas-inspired layered shadow) as a **structural and textural** language, not literal religious iconography — no crescent-and-star clichés, no mosque silhouettes as decoration. The geometry should read as "precision, order, and craftsmanship," which is also exactly what a trustworthy ticketing/finance product should communicate.

Avoid the generic AI-template defaults: no cream-background-plus-terracotta-accent look, no near-black-plus-neon-green look, no default SaaS card grid with rounded-corner-shadow-everywhere. Where the two tiers differ, the difference should be genuinely felt (materiality, restraint vs richness) — not just a different accent color on the same layout.

## 2. Core palette (shared foundation)

| Token | Hex | Use |
|---|---|---|
| Ink | `#10201D` | Primary dark background (deep teal-black — evokes ledger paper at night, not pure black) |
| Ink-2 | `#1C352D` | Elevated surfaces / cards on dark backgrounds |
| Paper | `#F6F1E4` | Primary light background / text-on-dark |
| Paper-2 | `#EDE6D3` | Elevated surfaces on light backgrounds |
| Emerald | `#23473B` | Secondary deep green — halal/ethical association, used structurally not decoratively |
| Gold | `#B98A46` | Primary accent — brass/minted-coin gold, muted, never shiny/neon |
| Gold-light | `#DCB87C` | Accent highlights, hover states |
| Line | `#CABB9C` | Hairlines, dividers, borders |
| Muted text | `#6D6353` | Secondary text |

## 3. Tier differentiation

**Standard tier**
- Ink background, single gold accent, restrained geometric linework used only at edges/dividers (thin, precise, not filling space).
- Ticket/badge: flat card, one perforated stub, single-color foil-style line accent.
- Copy tone: clear, functional, welcoming.

**Premium tier**
- Same palette family, but richer: a subtle full interlacing geometric pattern as a low-opacity background texture (not a loud pattern — barely-there, like an embossed watermark), a second metallic tone (consider a warm bronze/rose-gold hairline alongside the primary gold), slightly heavier paper-weight feel via layered shadow/border.
- Ticket/badge: an additional foil-style border treatment, a small geometric emblem (an eight-point star motif, abstracted, used the way a wax seal or hallmark would be used — small, corner-placed, not centered/loud).
- Copy tone: same voice, slightly more considered pacing — e.g. "Reserved seating" stated plainly rather than oversold.

The distinction should read the way premium vs standard event badges, boarding passes, or bank cards read in real life: same family, more craftsmanship — never a different app.

## 4. Typography

- **Display**: a serif with editorial warmth and enough weight range for italics as a voice (used in the registration app prototype: Newsreader). Reserve italic display type for thesis-style statements ("Register your seat among the ethical generation") — not every heading.
- **Body**: a clean grotesque/humanist sans (Inter) for forms, dashboard tables, and body copy — legibility does the work here, not personality.
- **Utility/mono**: a monospace (Space Mono) for anything that reads as data or credential — ticket IDs, short codes, timestamps, dashboard table figures. This is deliberate: it visually marks "this is a code/number you can trust," distinct from prose.

## 5. Motif system

- **Eight-point star (khatam) motif**: abstracted to a simple geometric mark, used sparingly as a corner emblem (premium tier), a loading-state motif, or a section divider — never as a repeating wallpaper pattern at full opacity.
- **Interlacing line work**: thin gold/bronze hairlines that cross and weave, used as background texture at 4–8% opacity max, or as literal dividers between sections (a woven double-line instead of a plain `<hr>`).
- **Arch silhouette**: consider for card tops or section breaks (a very subtle pointed/rounded arch edge) — evokes mihrab/window arch forms without being literal architecture.
- **Perforation / ticket-stub language**: already established in the registration app prototype — keep this as the connective visual thread between the on-screen ticket, the emailed ticket, and the door check-in confirmation screen, so an attendee recognizes "their ticket" across every surface.

## 6. Screen-by-screen prompts

### 6.1 Landing page (separate track, once ready)
Prompt: "Design a one-page event site for a premium, youth-facing Islamic finance summit. Hero should open with the thesis statement, not a generic stat block — treat the headline itself as the signature element, set in the display serif, with a restrained interlacing-line background treatment. Sections: About, Summit Experience, Speakers, Programme, Registration CTA, Sponsors/Partners, FAQ, Footer — per the existing content brief. Ticket CTA should visually preview the Standard/Premium distinction before the visitor even clicks through to register."

### 6.2 Registration app (already prototyped — extend, don't restart)
- Add the Standard/Premium tier selector alongside the existing category selector (likely a second choice step, or a combined 3×2 grid of category-by-tier if that reads cleanly at the chosen breakpoint — test both).
- Apply the premium watermark/emblem treatment to the live ticket preview only when Premium is selected, so the preview itself sells the upgrade.
- Payment step: keep it boring and trustworthy on purpose — this is not where to spend visual boldness. Clear price breakdown, provider logo, no dark patterns.

### 6.3 Confirmation screen
Prompt: "Design the post-payment confirmation state. It should feel like a moment of completion, not just a status message — the ticket preview becomes the hero of the screen, transitions from 'Pending' to 'Confirmed' with a restrained motion moment (not confetti/emoji-tier celebration — think a seal being stamped, or a card being 'issued'). State clearly that the e-ticket with QR and short code has been emailed."

### 6.4 Ticket email
Prompt: "Design a transactional email that reads as the ticket itself, not a marketing email wrapping a ticket. Use the same ticket-stub visual language as the on-screen preview: attendee name, category, tier (with premium emblem if applicable), event date/venue, a large clean QR code, and the short code set in mono type at a size someone could read aloud over the phone. Include one line of instruction ('Show this QR code or the code below at the door') and a support contact. Must render correctly in dark-mode and light-mode email clients, and remain legible if printed in black and white — don't rely on the gold accent alone to carry information."

### 6.5 Admin dashboard
Prompt: "Design an internal operations dashboard — this is a working tool, not a marketing surface, so shift toward the Standard tier's restraint, on a light paper background for readability during long shifts rather than the dark ink theme used for attendee-facing screens. Keep the gold accent and mono-for-data convention for continuity, but prioritize table density, clear status badges (pending/paid/failed/checked-in), and fast filtering over decorative elements. Registry/check-in view should foreground a live counter (checked-in / total) as the dominant visual element on event day."

### 6.6 Check-in scanner (PWA)
Prompt: "Design a full-screen, high-contrast scanner interface for door staff, usable in bright outdoor light and under time pressure. Large camera viewfinder, a persistent manual short-code entry field always visible (not hidden behind a toggle), and an unmistakable full-screen color result state: green wash + checkmark + attendee name for valid-first-use, red wash + clear 'already used, first scanned at [time]' for duplicates, red wash + 'not found' for invalid codes. No decorative motifs on this screen — every element earns its place by helping a volunteer move fast."

## 7. Accessibility & quality floor

- Verify contrast ratios on the ink/gold combination at actual text sizes used — gold-on-ink reads well as an accent but may need a lighter gold-light variant for body-size text to meet WCAG AA.
- All interactive elements (ticket type cards, tier toggle, admin table rows, scanner result states) need visible keyboard focus states, not just hover states.
- Respect reduced-motion preferences for the confirmation "seal/issue" moment and any dashboard live-count animation.
- Test the ticket email in at least one dark-mode client — gold-on-dark can invert or lose contrast unpredictably depending on client rendering.