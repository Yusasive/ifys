import {
  isBlankBroadcastHtml,
  renderBroadcastBodyHtml,
  sanitizeBroadcastHtml,
} from './broadcast-html';

describe('sanitizeBroadcastHtml', () => {
  it('keeps formatting tags and safe links', () => {
    const html = sanitizeBroadcastHtml(
      '<h2>Hi</h2><p><strong>Bold</strong> <em>it</em> <a href="https://chat.whatsapp.com/abc">join</a></p><ul><li>one</li></ul>',
    );
    expect(html).toBe(
      '<h2>Hi</h2><p><strong>Bold</strong> <em>it</em> <a href="https://chat.whatsapp.com/abc">join</a></p><ul><li>one</li></ul>',
    );
  });

  it('strips scripts, event handlers, styles and javascript: links', () => {
    const html = sanitizeBroadcastHtml(
      '<p onclick="x()" style="color:red">ok<script>alert(1)</script></p><a href="javascript:alert(1)">bad</a><img src="x" onerror="y()">',
    );
    expect(html).toBe('<p>ok</p><a>bad</a>');
  });
});

describe('isBlankBroadcastHtml', () => {
  it('treats an empty editor as blank', () => {
    expect(isBlankBroadcastHtml('<p></p>')).toBe(true);
    expect(isBlankBroadcastHtml('<p>  </p><br />')).toBe(true);
    expect(isBlankBroadcastHtml('<p>Hello</p>')).toBe(false);
  });
});

describe('renderBroadcastBodyHtml', () => {
  it('substitutes the escaped first name for {{name}}', () => {
    const html = renderBroadcastBodyHtml({
      bodyHtml: '<p>Hi {{ name }},</p>',
      recipientName: '<b>Musa</b> Ibrahim',
    });
    expect(html).toContain('Hi &lt;b&gt;Musa&lt;/b&gt;,');
    expect(html).not.toContain('<b>Musa');
  });

  it('inlines styles and opens links in a new tab', () => {
    const html = renderBroadcastBodyHtml({
      bodyHtml: '<p><a href="https://example.com">x</a></p>',
      recipientName: 'A',
    });
    expect(html).toMatch(/<p style="[^"]+">/);
    expect(html).toMatch(
      /<a href="https:\/\/example.com" style="[^"]+" target="_blank">/,
    );
  });

  it('renders the CTA button only when label and url are both set', () => {
    const withCta = renderBroadcastBodyHtml({
      bodyHtml: '<p>x</p>',
      recipientName: 'A',
      ctaLabel: 'Join WhatsApp group',
      ctaUrl: 'https://chat.whatsapp.com/abc?x=1&y=2',
    });
    expect(withCta).toContain('Join WhatsApp group');
    expect(withCta).toContain(
      'href="https://chat.whatsapp.com/abc?x=1&amp;y=2"',
    );

    const without = renderBroadcastBodyHtml({
      bodyHtml: '<p>x</p>',
      recipientName: 'A',
      ctaLabel: 'Join',
    });
    expect(without).not.toContain('Join');
  });
});
