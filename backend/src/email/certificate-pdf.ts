import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import {
  CERTIFICATE_HEIGHT_PX,
  CERTIFICATE_WIDTH_PX,
  NAME_BASELINE_PX,
  NAME_COLOR,
  NAME_LEFT_PX,
  NAME_MAX_FONT_PX,
  NAME_MAX_WIDTH_PX,
  NAME_MIN_FONT_PX,
} from './certificate-layout';

// A4 landscape width; the height follows the template's own proportions so
// the artwork is never stretched.
const PAGE_WIDTH_PT = 841.89;
const PAGE_HEIGHT_PT =
  (PAGE_WIDTH_PT * CERTIFICATE_HEIGHT_PX) / CERTIFICATE_WIDTH_PX;
const PT_PER_PX = PAGE_WIDTH_PT / CERTIFICATE_WIDTH_PX;

let cachedAssets: { template: Buffer; font: Buffer } | undefined;
function loadAssets() {
  cachedAssets ??= {
    template: readFileSync(
      join(__dirname, 'assets', 'certificate-template.png'),
    ),
    font: readFileSync(join(__dirname, 'assets', 'certificate-name-font.ttf')),
  };
  return cachedAssets;
}

// The certificate template with only the recipient's name added.
export function generateCertificatePdf(name: string): Promise<Buffer> {
  const { template, font } = loadAssets();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_WIDTH_PT, PAGE_HEIGHT_PT],
      margin: 0,
      info: { Title: 'Certificate of Participation' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.image(template, 0, 0, { width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT });

    const displayName = name.trim().replace(/\s+/g, ' ');
    doc.font(font);
    // Longest names shrink to fit the line instead of running off the page.
    let fontPx = NAME_MAX_FONT_PX;
    doc.fontSize(fontPx * PT_PER_PX);
    const widthAtMax = doc.widthOfString(displayName) / PT_PER_PX;
    if (widthAtMax > NAME_MAX_WIDTH_PX) {
      fontPx = Math.max(
        NAME_MIN_FONT_PX,
        Math.floor((fontPx * NAME_MAX_WIDTH_PX) / widthAtMax),
      );
    }
    doc.fontSize(fontPx * PT_PER_PX).fillColor(NAME_COLOR);
    doc.text(
      displayName,
      NAME_LEFT_PX * PT_PER_PX,
      NAME_BASELINE_PX * PT_PER_PX,
      {
        lineBreak: false,
        baseline: 'alphabetic',
      },
    );
    doc.end();
  });
}
