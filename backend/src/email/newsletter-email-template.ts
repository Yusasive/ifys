import { INK, renderEmailShell } from './email-shell';

export interface NewsletterEmailData {
  supportEmail: string;
}

export function renderNewsletterConfirmationHtml(
  data: NewsletterEmailData,
): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:22px;">You&rsquo;re on the list!</p>
    <p style="margin:0;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};">
      Thanks for signing up for updates. We&rsquo;ll keep you posted on speakers, schedule
      changes, and everything else worth knowing before the event — no spam, just the
      good stuff.
    </p>
  `;

  return renderEmailShell({
    eventName: 'Islamic Finance Youth Summit',
    bodyHtml,
    supportEmail: data.supportEmail,
  });
}
