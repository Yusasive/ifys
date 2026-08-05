export interface VolunteerApplicationEmailData {
  fullName: string;
  teamLabel: string;
  eventName: string;
  supportEmail: string;
}

const PAPER = '#F6F1E4';
const INK = '#10201D';
const GOLD = '#B98A46';
const LINE = '#CABB9C';
const MUTED = '#6D6353';

// Same table-based, inline-style shell as the other transactional emails
// (design.md §6.4: must render in dark/light clients, no web fonts).
function renderShellHtml(
  heading: string,
  body: string,
  data: VolunteerApplicationEmailData,
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

export function renderVolunteerApplicationReceivedHtml(
  data: VolunteerApplicationEmailData,
): string {
  const body = `Hi ${data.fullName},<br /><br />
    Thanks for applying to join the ${data.teamLabel} for ${data.eventName}.
    Our team will review your application and get back to you soon.`;
  return renderShellHtml('Application received', body, data);
}

export function renderVolunteerApplicationApprovedHtml(
  data: VolunteerApplicationEmailData,
): string {
  const body = `Hi ${data.fullName},<br /><br />
    Congratulations — you've been selected to join the ${data.teamLabel} for ${data.eventName}.
    We'll be in touch shortly with orientation details and your event-day responsibilities.
    Thank you for stepping up to volunteer.`;
  return renderShellHtml("You're in!", body, data);
}

export function renderVolunteerApplicationRejectedHtml(
  data: VolunteerApplicationEmailData,
): string {
  const body = `Hi ${data.fullName},<br /><br />
    Thank you for applying to volunteer for ${data.eventName}.
    After review, we're not able to bring you onto the ${data.teamLabel} at this time.
    We appreciate your interest and hope to see you at the event.`;
  return renderShellHtml('Application update', body, data);
}
