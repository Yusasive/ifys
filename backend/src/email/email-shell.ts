export const ORANGE = '#E8734A';
export const INK = '#10201D';
export const LINE = '#CABB9C';
export const MUTED = '#6D6353';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderEmailShell(opts: {
  eventName: string;
  bodyHtml: string;
  supportEmail: string;
  // Broadcasts only — transactional emails (tickets etc.) have no opt-out.
  unsubscribeUrl?: string;
}): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:24px;background-color:${ORANGE};font-family:Georgia,'Times New Roman',serif;color:${INK};">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding-bottom:20px;text-align:center;">
        <img src="cid:brand-logo" alt="${opts.eventName}" width="180" style="display:block;margin:0 auto 12px;border:0;" />
        <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ffffff;font-family:Arial,sans-serif;">
          ${opts.eventName}
        </p>
      </td>
    </tr>
    <tr>
      <td style="border-radius:8px;padding:24px;background-color:#ffffff;">
        ${opts.bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding-top:16px;font-family:Arial,sans-serif;font-size:12px;color:#ffffff;text-align:center;">
        Questions? Contact ${opts.supportEmail}${
          opts.unsubscribeUrl
            ? `<br /><a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#ffffff;">Unsubscribe from these updates</a>`
            : ''
        }
      </td>
    </tr>
  </table>
</body>
</html>`;
}
