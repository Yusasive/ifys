import { escapeHtml, INK, renderEmailShell } from './email-shell';

export interface StudentReviewAttendeeEmailData {
  fullName: string;
  eventName: string;
  supportEmail: string;
  reason?: string;
}

function renderAttendeeShellHtml(
  heading: string,
  body: string,
  data: StudentReviewAttendeeEmailData,
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

export function renderStudentRegistrationPendingHtml(
  data: StudentReviewAttendeeEmailData,
): string {
  const body = `Hi ${escapeHtml(data.fullName)},<br /><br />
    Thanks for registering for ${data.eventName} and completing payment. Since you registered
    under the student category, we're verifying your uploaded student ID before issuing your
    ticket. This usually doesn't take long — we'll email your ticket as soon as it's approved.`;
  return renderAttendeeShellHtml(
    'Your registration is under review',
    body,
    data,
  );
}

export function renderStudentRegistrationRejectedHtml(
  data: StudentReviewAttendeeEmailData,
): string {
  const body = `Hi ${escapeHtml(data.fullName)},<br /><br />
    We weren't able to verify your student status for ${data.eventName} from the ID you
    uploaded, so we can't issue a student ticket for this registration.
    ${data.reason ? `<br /><br />Reason: ${escapeHtml(data.reason)}` : ''}
    <br /><br />
    Please contact us at ${data.supportEmail} to discuss a refund or registering under a
    different category.`;
  return renderAttendeeShellHtml(
    "We couldn't verify your student status",
    body,
    data,
  );
}

export interface StudentReviewAdminNotifyEmailData {
  eventName: string;
  supportEmail: string;
  attendeeName: string;
  reviewUrl: string;
}

export function renderStudentReviewAdminNotifyHtml(
  data: StudentReviewAdminNotifyEmailData,
): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:22px;">New student ticket awaiting review</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};">
      ${escapeHtml(data.attendeeName)} paid for a student ticket to ${data.eventName} and is
      waiting on ID verification before their ticket can be issued.
    </p>
    <p style="margin:0;text-align:center;">
      <a href="${data.reviewUrl}" style="display:inline-block;background-color:${INK};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px;">
        Review registration
      </a>
    </p>
  `;
  return renderEmailShell({
    eventName: data.eventName,
    bodyHtml,
    supportEmail: data.supportEmail,
  });
}
