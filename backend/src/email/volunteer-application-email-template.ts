import { INK, renderEmailShell } from './email-shell';

export interface VolunteerApplicationEmailData {
  fullName: string;
  teamLabel: string;
  eventName: string;
  supportEmail: string;
}

function renderShellHtml(
  heading: string,
  body: string,
  data: VolunteerApplicationEmailData,
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
