// Shared table-based, inline-style shell for every transactional email —
// per design.md §6.4: must render in dark/light clients and stay legible
// printed in black and white, so no web fonts and no color-only signal.
// The brand logo is attached as a CID image by EmailService (a `cid:` ref
// renders reliably across real mail clients, unlike a `data:` URI, which
// many block) — see EmailService.brandLogoAttachment.
export const ORANGE = '#E8734A';
export const INK = '#10201D';
export const LINE = '#CABB9C';
export const MUTED = '#6D6353';

export function renderEmailShell(opts: {
  eventName: string;
  bodyHtml: string;
  supportEmail: string;
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
        Questions? Contact ${opts.supportEmail}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
