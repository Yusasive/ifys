export interface NewsletterEmailData {
  supportEmail: string;
}

const PAPER = '#F6F1E4';
const INK = '#10201D';
const GOLD = '#B98A46';
const LINE = '#CABB9C';
const MUTED = '#6D6353';

// Same table-based, inline-style shell as the other transactional emails
// (design.md §6.4: must render in dark/light clients, no web fonts).
export function renderNewsletterConfirmationHtml(
  data: NewsletterEmailData,
): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:24px;background-color:${PAPER};font-family:Georgia,'Times New Roman',serif;color:${INK};">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding-bottom:16px;">
        <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};font-family:Arial,sans-serif;">
          Islamic Finance Youth Summit
        </p>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid ${LINE};border-radius:4px;padding:24px;background-color:#ffffff;">
        <p style="margin:0 0 16px;font-size:22px;">You&rsquo;re on the list!</p>
        <p style="margin:0;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};">
          Thanks for signing up for updates. We&rsquo;ll keep you posted on speakers, schedule
          changes, and everything else worth knowing before the event — no spam, just the
          good stuff.
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
