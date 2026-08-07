import { INK, renderEmailShell } from './email-shell';

export interface SponsorApplicationEmailData {
  contactName: string;
  organizationName: string;
  typeLabel: string;
  eventName: string;
  supportEmail: string;
}

function renderShellHtml(
  heading: string,
  body: string,
  data: SponsorApplicationEmailData,
): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:22px;">${heading}</p>
    <p style="margin:0;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};">
      ${body}
    </p>
  `;
  return renderEmailShell({
    eventName: data.eventName,
    bodyHtml,
    supportEmail: data.supportEmail,
  });
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
