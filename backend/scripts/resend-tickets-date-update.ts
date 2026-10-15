/**
 * One-time script: resend every valid ticket for the IFY Summit with the
 * corrected event date (Nov 7 -> Nov 5).
 *
 * The ticket itself is NOT changed. Each attendee gets the same QR code and
 * the same ticket code they already have, rebuilt into a fresh email + PDF
 * that reads the date from the database, with a short "date update" note.
 *
 * Usage (from the backend/ folder, with production env vars loaded):
 *
 *   npx tsx scripts/resend-tickets-date-update.ts            # dry run, sends nothing
 *   npx tsx scripts/resend-tickets-date-update.ts --send     # actually sends
 *
 * Options:
 *   --send          Send the emails. Without it the script only lists recipients.
 *   --to=<email>    Send only to this attendee (good for testing on yourself first).
 *   --delay=<ms>    Pause between emails, default 1500, to stay under SMTP limits.
 *
 * Safe to re-run: every successful send is written to
 * scripts/.resend-date-update-sent.txt and skipped next time, so if it stops
 * halfway you can just run it again.
 */
import 'dotenv/config';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/email/email.service';
import { CATEGORY_LABELS, TIER_LABELS } from '../src/email/labels';

const EVENT_SLUG = 'ify-summit-2026';
const EXPECTED_DATE_UTC = '2026-11-05';
const SENT_LOG = join(__dirname, '.resend-date-update-sent.txt');

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const send = process.argv.includes('--send');
  const onlyTo = getArg('to')?.toLowerCase();
  const delayMs = Number(getArg('delay') ?? 1500);

  const config = new ConfigService();
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const event = await prisma.event.findUnique({
      where: { slug: EVENT_SLUG },
    });
    if (!event) throw new Error(`Event "${EVENT_SLUG}" not found`);

    // Refuse to send if the database still has the wrong date, otherwise
    // we'd mail everyone the same wrong ticket again.
    const dbDate = event.startsAt.toISOString().slice(0, 10);
    if (dbDate !== EXPECTED_DATE_UTC) {
      throw new Error(
        `Event date in the database is ${event.startsAt.toISOString()}, expected ${EXPECTED_DATE_UTC}. Fix the date before resending.`,
      );
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        status: { not: 'void' },
        registration: { eventId: event.id },
      },
      include: {
        registration: { include: { attendee: true, ticketProduct: true } },
      },
      orderBy: { issuedAt: 'asc' },
    });

    const alreadySent = new Set(
      existsSync(SENT_LOG)
        ? readFileSync(SENT_LOG, 'utf8').split('\n').filter(Boolean)
        : [],
    );

    const queue = tickets.filter(
      (t) =>
        !alreadySent.has(t.id) &&
        (!onlyTo || t.registration.attendee.email.toLowerCase() === onlyTo),
    );

    console.log(`Event: ${event.name}, starts ${event.startsAt.toISOString()}`);
    console.log(`Valid tickets: ${tickets.length}`);
    console.log(`Already sent earlier: ${alreadySent.size}`);
    console.log(
      `To send now: ${queue.length}${onlyTo ? ` (filtered to ${onlyTo})` : ''}`,
    );
    console.log('');

    if (!send) {
      for (const t of queue) {
        console.log(`  ${t.ticketCode}  ${t.registration.attendee.email}`);
      }
      console.log(
        '\nDry run only. Re-run with --send to email these attendees.',
      );
      return;
    }

    const email = new EmailService(config);
    const supportEmail = config.getOrThrow<string>('SUPPORT_EMAIL');
    let ok = 0;
    const failed: string[] = [];

    for (const [i, t] of queue.entries()) {
      const { attendee, ticketProduct } = t.registration;
      try {
        await email.sendTicketEmail(
          attendee.email,
          {
            fullName: attendee.fullName,
            categoryLabel: CATEGORY_LABELS[ticketProduct.category],
            tierLabel: TIER_LABELS[ticketProduct.tier],
            eventName: event.name,
            venue: event.venue,
            startsAt: event.startsAt,
            ticketCode: t.ticketCode,
            ticketId: t.id,
            supportEmail,
            variant: 'date_updated',
          },
          t.qrSecret,
        );
        appendFileSync(SENT_LOG, `${t.id}\n`);
        ok++;
        console.log(
          `[${i + 1}/${queue.length}] sent  ${t.ticketCode}  ${attendee.email}`,
        );
      } catch (err) {
        failed.push(attendee.email);
        console.error(
          `[${i + 1}/${queue.length}] FAILED ${t.ticketCode}  ${attendee.email}: ${String(err)}`,
        );
      }
      if (i < queue.length - 1) await sleep(delayMs);
    }

    console.log(`\nDone. Sent ${ok}, failed ${failed.length}.`);
    if (failed.length) {
      console.log('Failed (run the script again to retry them):');
      for (const f of failed) console.log(`  ${f}`);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
