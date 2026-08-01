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
}

const PAPER = '#F6F1E4';
const INK = '#10201D';
const GOLD = '#B98A46';
const LINE = '#CABB9C';
const MUTED = '#6D6353';

// Table-based layout, inline styles, no web fonts, no gold-only signal —
// per design.md §6.4: must render in dark/light email clients and stay
// legible printed in black and white. QR is attached as a CID image so it
// renders in real mail clients (unlike a data: URI, which many block).
export function renderTicketEmailHtml(data: TicketEmailData): string {
  const eventDate = data.startsAt.toLocaleString('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  });

  return `<!doctype html>
<html>
<body style="margin:0;padding:24px;background-color:${PAPER};font-family:Georgia,'Times New Roman',serif;color:${INK};">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding-bottom:16px;">
        <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};font-family:Arial,sans-serif;">
          ${data.eventName}
        </p>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid ${LINE};border-radius:4px;padding:24px;background-color:#ffffff;">
        <p style="margin:0 0 4px;font-size:22px;">${data.fullName}</p>
        <p style="margin:0 0 20px;font-size:14px;color:${MUTED};font-family:Arial,sans-serif;">
          ${data.categoryLabel} &middot; ${data.tierLabel}
        </p>

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

        <p style="margin:0;font-size:28px;letter-spacing:6px;font-family:'Courier New',Courier,monospace;font-weight:bold;">
          ${data.ticketCode}
        </p>

        <p style="margin:20px 0 0;font-size:11px;color:${MUTED};font-family:Arial,sans-serif;">
          Ticket ID: ${data.ticketId}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding-top:16px;font-family:Arial,sans-serif;font-size:12px;color:${MUTED};">
        Questions? Contact ${data.supportEmail}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
