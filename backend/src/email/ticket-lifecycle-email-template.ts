import { escapeHtml, INK, renderEmailShell } from './email-shell';

export type TicketLifecycleKind = 'voided' | 'restored' | 'withdrawn';

export interface TicketLifecycleEmailData {
  fullName: string;
  eventName: string;
  supportEmail: string;
}

// Fixed, generic copy per kind — deliberately does NOT interpolate the
// admin's free-text reason (kept in the audit log / Ticket.lastActionReason
// for internal use only), since admin shorthand ("suspected fraud",
// "chargeback") isn't attendee-appropriate copy.
const HEADINGS: Record<TicketLifecycleKind, string> = {
  voided: 'Your ticket has been voided',
  restored: 'Your ticket is valid again',
  withdrawn: 'Your ticket has been withdrawn',
};

const BODIES: Record<TicketLifecycleKind, (eventName: string) => string> = {
  voided: (eventName) =>
    `Your ticket for ${eventName} has been voided and is no longer valid for entry. If you believe this is a mistake, please get in touch with us.`,
  restored: (eventName) =>
    `Good news — your ticket for ${eventName} is valid again. Your original QR code and ticket number both work as before.`,
  withdrawn: (eventName) =>
    `Your reissued ticket for ${eventName} has been withdrawn and is no longer valid for entry. If you believe this is a mistake, please get in touch with us.`,
};

export function renderTicketLifecycleEmailHtml(
  kind: TicketLifecycleKind,
  data: TicketLifecycleEmailData,
): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:22px;">${HEADINGS[kind]}</p>
    <p style="margin:0;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};">
      Hi ${escapeHtml(data.fullName)},<br /><br />
      ${escapeHtml(BODIES[kind](data.eventName))}
    </p>
  `;
  return renderEmailShell({
    eventName: data.eventName,
    bodyHtml,
    supportEmail: data.supportEmail,
  });
}
