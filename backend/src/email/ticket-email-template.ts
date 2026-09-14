import { escapeHtml, INK, LINE, MUTED, renderEmailShell } from './email-shell';

export type TicketEmailVariant = 'issued' | 'resent' | 'reissued';

export interface TicketEmailData {
  fullName: string;
  categoryLabel: string;
  tierLabel: string;
  eventName: string;
  venue: string;
  startsAt: Date;
  ticketCode: string;
  ticketId: string;
  supportEmail: string;
  variant?: TicketEmailVariant;
}

const VARIANT_INTROS: Record<TicketEmailVariant, string> = {
  issued: '',
  resent: '',
  reissued:
    "Here's your reissued ticket. The QR code and ticket number below are new — any earlier copy of this ticket will no longer scan at the door.",
};

export function renderTicketEmailHtml(data: TicketEmailData): string {
  const eventDate = data.startsAt.toLocaleString('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });
  const intro = VARIANT_INTROS[data.variant ?? 'issued'];

  const bodyHtml = `
    <p style="margin:0 0 4px;font-size:22px;">${data.fullName}</p>
    <p style="margin:0 0 20px;font-size:14px;color:${MUTED};font-family:Arial,sans-serif;">
      ${data.categoryLabel} &middot; ${data.tierLabel}
    </p>
    ${intro ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.5;font-family:Arial,sans-serif;color:${INK};">${escapeHtml(intro)}</p>` : ''}

    <table role="presentation" width="100%" style="border-top:1px dashed ${LINE};border-bottom:1px dashed ${LINE};margin-bottom:20px;">
      <tr>
        <td style="padding:16px 0;font-family:Arial,sans-serif;font-size:13px;color:${MUTED};">
          ${eventDate}<br />${data.venue}
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};font-family:Arial,sans-serif;">
      Show this QR code or the code below at the door
    </p>
    <img src="cid:ticket-qr" alt="Ticket QR code" width="180" height="180" style="display:block;margin-bottom:16px;" />

    <p style="margin:0;font-size:28px;letter-spacing:6px;font-family:'Courier New',Courier,monospace;font-weight:bold;color:${INK};">
      ${data.ticketCode}
    </p>

    <p style="margin:20px 0 0;font-size:11px;color:${MUTED};font-family:Arial,sans-serif;">
      Ticket ID: ${data.ticketId}
    </p>

    <p style="margin:20px 0 0;font-size:13px;font-family:Arial,sans-serif;color:${MUTED};">
      A PDF copy of this ticket is attached — save it or print it for the door.
    </p>
  `;

  return renderEmailShell({
    eventName: data.eventName,
    bodyHtml,
    supportEmail: data.supportEmail,
  });
}
