import { escapeHtml, INK, renderEmailShell } from './email-shell';

export interface RegistrationReminderEmailData {
  fullName: string;
  eventName: string;
  categoryLabel: string;
  tierLabel: string;
  resumeUrl: string;
  supportEmail: string;
}

export function renderRegistrationPendingPaymentReminderHtml(
  data: RegistrationReminderEmailData,
): string {
  const safeName = escapeHtml(data.fullName);
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:22px;">Complete your registration</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};">
      Hi ${safeName},<br /><br />
      You started registering for ${data.eventName} (${data.categoryLabel} · ${data.tierLabel}) but haven't
      completed payment yet. Your spot isn't guaranteed until payment is confirmed.
    </p>
    <p style="margin:0 0 16px;text-align:center;">
      <a href="${data.resumeUrl}" style="display:inline-block;background-color:${INK};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px;">
        Complete your payment
      </a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};">
      If you've already completed payment or no longer wish to register, you can safely ignore this email.
    </p>
  `;
  return renderEmailShell({
    eventName: data.eventName,
    bodyHtml,
    supportEmail: data.supportEmail,
  });
}
