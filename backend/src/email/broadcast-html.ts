import sanitizeHtml from 'sanitize-html';
import { escapeHtml, INK, ORANGE } from './email-shell';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'hr',
];

export function sanitizeBroadcastHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
  });
}

// True when the sanitized body has no visible text (e.g. the editor's
// empty "<p></p>").
export function isBlankBroadcastHtml(html: string): boolean {
  return sanitizeHtml(html, { allowedTags: [] }).trim().length === 0;
}

// Email clients ignore <style> blocks unreliably, so the tags the editor
// produces get inline styles that match the rest of the email templates.
const INLINE_STYLES: Record<string, string> = {
  p: `margin:0 0 14px;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};`,
  h2: `margin:0 0 12px;font-size:20px;line-height:1.3;color:${INK};`,
  h3: `margin:0 0 10px;font-size:17px;line-height:1.3;color:${INK};`,
  ul: `margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};`,
  ol: `margin:0 0 14px;padding-left:22px;font-size:15px;line-height:1.6;font-family:Arial,sans-serif;color:${INK};`,
  li: 'margin:0 0 4px;',
  blockquote: `margin:0 0 14px;padding:4px 0 4px 12px;border-left:3px solid ${ORANGE};font-family:Arial,sans-serif;color:${INK};`,
  a: `color:${ORANGE};text-decoration:underline;`,
  hr: 'border:0;border-top:1px solid #e5e5e5;margin:16px 0;',
};

function inlineStyles(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'style', 'target'], '*': ['style'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: Object.fromEntries(
      Object.entries(INLINE_STYLES).map(([tag, style]) => [
        tag,
        (tagName: string, attribs: Record<string, string>) => ({
          tagName,
          attribs: {
            ...attribs,
            style,
            ...(tagName === 'a' ? { target: '_blank' } : {}),
          },
        }),
      ]),
    ),
  });
}

export interface BroadcastBodyData {
  bodyHtml: string;
  recipientName: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

export function renderBroadcastBodyHtml(data: BroadcastBodyData): string {
  const firstName = data.recipientName.trim().split(/\s+/)[0] || 'there';
  const personalized = data.bodyHtml.replace(
    /\{\{\s*name\s*\}\}/gi,
    escapeHtml(firstName),
  );

  const cta =
    data.ctaLabel && data.ctaUrl
      ? `
    <p style="margin:8px 0 4px;text-align:center;">
      <a href="${escapeHtml(data.ctaUrl)}" target="_blank" style="display:inline-block;background-color:${INK};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px;">
        ${escapeHtml(data.ctaLabel)}
      </a>
    </p>`
      : '';

  return `${inlineStyles(personalized)}${cta}`;
}
