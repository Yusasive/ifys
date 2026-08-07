import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { TicketEmailData } from './ticket-email-template';

const ORANGE = '#E8734A';
const INK = '#10201D';
const MUTED = '#6D6353';

// Loaded once and cached — same brand logo PNG the email shell attaches
// as cid:brand-logo (see email.service.ts), just also usable here by any
// caller that needs a standalone PDF (the ticket-email queue and the
// GET /registrations/:id/ticket.pdf download endpoint both do).
let cachedLogo: Buffer | null | undefined;
function loadBrandLogo(): Buffer | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    cachedLogo = readFileSync(join(__dirname, 'assets', 'logo.png'));
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

// A4-ish single-page ticket: orange header band with the brand logo, then
// attendee/event details, then the QR code + short code to scan/read at
// the door. Built with pdfkit (pure JS, no headless-browser dependency)
// so it runs the same in the email worker as anywhere else in the process.
export function generateTicketPdf(
  data: TicketEmailData,
  qrPngBuffer: Buffer,
): Promise<Buffer> {
  const logoPngBuffer = loadBrandLogo();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [360, 640], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 360;

    // Header band
    doc.rect(0, 0, pageWidth, 140).fill(ORANGE);
    if (logoPngBuffer) {
      try {
        doc.image(logoPngBuffer, pageWidth / 2 - 60, 24, { width: 120 });
      } catch {
        // Logo is optional cosmetic — a broken/missing asset must not fail
        // ticket generation for a paying attendee.
      }
    }
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(data.eventName.toUpperCase(), 24, 100, {
        width: pageWidth - 48,
        align: 'center',
        characterSpacing: 1,
      });

    // Attendee + event details
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(data.fullName, 24, 168, { width: pageWidth - 48, align: 'center' });

    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(12)
      .text(`${data.categoryLabel} · ${data.tierLabel}`, 24, 196, {
        width: pageWidth - 48,
        align: 'center',
      });

    const eventDate = data.startsAt.toLocaleString('en-NG', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Africa/Lagos',
    });
    doc
      .fillColor(MUTED)
      .fontSize(11)
      .text(`${eventDate}\n${data.venue}`, 24, 224, {
        width: pageWidth - 48,
        align: 'center',
      });

    // QR + short code
    const qrSize = 200;
    doc.image(qrPngBuffer, pageWidth / 2 - qrSize / 2, 300, {
      width: qrSize,
      height: qrSize,
    });

    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(data.ticketCode, 24, 516, {
        width: pageWidth - 48,
        align: 'center',
        characterSpacing: 3,
      });

    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(9)
      .text(`Ticket ID: ${data.ticketId}`, 24, 552, {
        width: pageWidth - 48,
        align: 'center',
      });

    doc
      .fillColor(MUTED)
      .fontSize(9)
      .text(`Questions? Contact ${data.supportEmail}`, 24, 600, {
        width: pageWidth - 48,
        align: 'center',
      });

    doc.end();
  });
}
