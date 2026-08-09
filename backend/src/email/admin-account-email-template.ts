import { escapeHtml, INK, MUTED, renderEmailShell } from './email-shell';

export interface AdminAccountEmailData {
  name: string;
  email: string;
  password: string;
  roleLabel: string;
  loginUrl: string;
  supportEmail: string;
}

export function renderAdminAccountCreatedHtml(
  data: AdminAccountEmailData,
): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:22px;">Welcome to the team, ${escapeHtml(data.name)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};">
      An admin dashboard account was created for you as <strong>${escapeHtml(data.roleLabel)}</strong>.
      Sign in with the temporary credentials below, then set your own password —
      you'll be asked to on first login.
    </p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;">
      <tr>
        <td style="padding:4px 0;color:${MUTED};">Email</td>
        <td style="padding:4px 0;color:${INK};font-weight:bold;">${escapeHtml(data.email)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:${MUTED};">Temporary password</td>
        <td style="padding:4px 0;color:${INK};font-weight:bold;font-family:monospace;">${escapeHtml(data.password)}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};">
      <a href="${escapeHtml(data.loginUrl)}" style="color:${INK};">${escapeHtml(data.loginUrl)}</a>
    </p>
  `;

  return renderEmailShell({
    eventName: 'Islamic Finance Youth Summit',
    bodyHtml,
    supportEmail: data.supportEmail,
  });
}
