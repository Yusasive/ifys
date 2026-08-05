export interface SponsorApplicationEmailData {
  contactName: string;
  organizationName: string;
  typeLabel: string;
  eventName: string;
  supportEmail: string;
}

const PAPER = '#F6F1E4';
const INK = '#10201D';
const GOLD = '#B98A46';
const LINE = '#CABB9C';
const MUTED = '#6D6353';

// Same table-based, inline-style shell as ticket-email-template.ts (design.md
// §6.4: must render in dark/light clients, no web fonts) — just a shorter
// body since there's no QR/ticket code to show.
function renderShellHtml(
  heading: string,
  body: string,
  data: SponsorApplicationEmailData,
): string {
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
        <p style="margin:0 0 16px;font-size:22px;">${heading}</p>
        <p style="margin:0;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};">
          ${body}
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

export function renderSponsorApplicationReceivedHtml(
  data: SponsorApplicationEmailData,
): string {
  const body = `Hi ${data.contactName},<br /><br />
    Thanks for applying to become a ${data.typeLabel} for ${data.eventName} on behalf of ${data.organizationName}.
    Our team will review your application and get back to you soon.`;
  return renderShellHtml('Application received', body, data);
}

export function renderSponsorApplicationApprovedHtml(
  data: SponsorApplicationEmailData,
): string {
  const body = `Hi ${data.contactName},<br /><br />
    Great news — ${data.organizationName} has been approved as a ${data.typeLabel} for ${data.eventName}.
    We'll be in touch shortly with next steps. Thank you for supporting the event.`;
  return renderShellHtml("You're approved!", body, data);
}

export function renderSponsorApplicationRejectedHtml(
  data: SponsorApplicationEmailData,
): string {
  const body = `Hi ${data.contactName},<br /><br />
    Thank you for your interest in partnering with ${data.eventName} on behalf of ${data.organizationName}.
    After review, we're not able to move forward with your application as a ${data.typeLabel} at this time.
    We appreciate you reaching out and hope to connect in the future.`;
  return renderShellHtml('Application update', body, data);
}
