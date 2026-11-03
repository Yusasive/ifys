import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTransport, Transporter } from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import * as QRCode from 'qrcode';
import {
  AdminAccountEmailData,
  renderAdminAccountCreatedHtml,
} from './admin-account-email-template';
import { BroadcastBodyData, renderBroadcastBodyHtml } from './broadcast-html';
import { generateCertificatePdf } from './certificate-pdf';
import { escapeHtml, renderEmailShell } from './email-shell';
import {
  NewsletterEmailData,
  renderNewsletterConfirmationHtml,
} from './newsletter-email-template';
import {
  renderSponsorApplicationApprovedHtml,
  renderSponsorApplicationReceivedHtml,
  renderSponsorApplicationRejectedHtml,
  SponsorApplicationEmailData,
} from './sponsor-application-email-template';
import { generateTicketPdf } from './ticket-pdf';
import type { UnsubscribeLinks } from './unsubscribe-links';
import {
  renderTicketEmailHtml,
  TicketEmailData,
} from './ticket-email-template';
import {
  renderVolunteerApplicationApprovedHtml,
  renderVolunteerApplicationReceivedHtml,
  renderVolunteerApplicationRejectedHtml,
  VolunteerApplicationEmailData,
} from './volunteer-application-email-template';
import {
  renderRegistrationPendingPaymentReminderHtml,
  RegistrationReminderEmailData,
} from './registration-reminder-email-template';
import {
  renderStudentRegistrationPendingHtml,
  renderStudentRegistrationRejectedHtml,
  renderStudentReviewAdminNotifyHtml,
  StudentReviewAdminNotifyEmailData,
  StudentReviewAttendeeEmailData,
} from './student-review-email-template';
import {
  renderTicketLifecycleEmailHtml,
  TicketLifecycleEmailData,
  TicketLifecycleKind,
} from './ticket-lifecycle-email-template';

@Injectable()
export class EmailService implements OnApplicationShutdown {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  private readonly logoBuffer: Buffer | null;

  constructor(config: ConfigService) {
    this.from = `"IFY Summit 2026" <${config.getOrThrow<string>('SMTP_FROM')}>`;
    const port = Number(config.getOrThrow<string>('SMTP_PORT'));
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');

    this.transporter = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port,

      secure: port === 465,
      auth: user && password ? { user, pass: password } : undefined,
      // One shared, rate-limited connection pool for every queue. Without
      // it each email opened (and authenticated) its own SMTP connection,
      // so a broadcast plus ticket emails at the same moment hit the SMTP
      // server as an unthrottled burst of logins and sends, and the provider
      // rejected some.
      pool: true,
      maxConnections: 2,
      rateDelta: 1000,
      rateLimit: 3,
    });

    try {
      this.logoBuffer = readFileSync(
        join(__dirname, 'assets', 'email-logo.png'),
      );
    } catch (err) {
      this.logger.warn(`Could not load brand logo asset: ${String(err)}`);
      this.logoBuffer = null;
    }
  }

  // The pooled connections stay open while idle, which kept the process
  // alive after shutdown — Jest never exited, so `git push` hung. Closed at
  // application shutdown, which runs after every queue worker's
  // onModuleDestroy has finished its last job — closing any earlier let a
  // worker's final send reopen a connection.
  onApplicationShutdown() {
    this.transporter.close();
  }

  private brandLogoAttachment(): Attachment[] {
    if (!this.logoBuffer) return [];
    return [
      {
        filename: 'email-logo.png',
        content: this.logoBuffer,
        cid: 'brand-logo',
      },
    ];
  }

  async sendTicketEmail(to: string, data: TicketEmailData, qrPayload: string) {
    const qrPngBuffer = await QRCode.toBuffer(qrPayload, {
      width: 360,
      margin: 1,
    });
    const pdfBuffer = await generateTicketPdf(data, qrPngBuffer);

    const subject =
      data.variant === 'reissued'
        ? `Your new ticket — ${data.eventName}`
        : data.variant === 'date_updated'
          ? `Date update: your ticket for ${data.eventName}`
          : `Your ticket — ${data.eventName}`;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html: renderTicketEmailHtml(data),
      attachments: [
        ...this.brandLogoAttachment(),
        {
          filename: 'ticket-qr.png',
          content: qrPngBuffer,
          cid: 'ticket-qr',
        },
        {
          filename: `ticket-${data.ticketCode}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    this.logger.log(`Ticket email sent to ${to} (ticket ${data.ticketId})`);
  }

  async sendSponsorApplicationReceivedEmail(
    to: string,
    data: SponsorApplicationEmailData,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Application received — ${data.eventName}`,
      html: renderSponsorApplicationReceivedHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Sponsor application received email sent to ${to}`);
  }

  async sendSponsorApplicationApprovedEmail(
    to: string,
    data: SponsorApplicationEmailData,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `You're approved as a ${data.typeLabel} — ${data.eventName}`,
      html: renderSponsorApplicationApprovedHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Sponsor application approved email sent to ${to}`);
  }

  async sendSponsorApplicationRejectedEmail(
    to: string,
    data: SponsorApplicationEmailData,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Application update — ${data.eventName}`,
      html: renderSponsorApplicationRejectedHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Sponsor application rejected email sent to ${to}`);
  }

  async sendNewsletterConfirmationEmail(to: string, data: NewsletterEmailData) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `You're subscribed for updates`,
      html: renderNewsletterConfirmationHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Newsletter confirmation email sent to ${to}`);
  }

  async sendVolunteerApplicationReceivedEmail(
    to: string,
    data: VolunteerApplicationEmailData,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Application received — ${data.eventName}`,
      html: renderVolunteerApplicationReceivedHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Volunteer application received email sent to ${to}`);
  }

  async sendVolunteerApplicationApprovedEmail(
    to: string,
    data: VolunteerApplicationEmailData,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `You're in! — ${data.eventName}`,
      html: renderVolunteerApplicationApprovedHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Volunteer application approved email sent to ${to}`);
  }

  async sendAdminAccountCreatedEmail(to: string, data: AdminAccountEmailData) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Your admin dashboard account',
      html: renderAdminAccountCreatedHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Admin account email sent to ${to}`);
  }

  async sendVolunteerApplicationRejectedEmail(
    to: string,
    data: VolunteerApplicationEmailData,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Application update — ${data.eventName}`,
      html: renderVolunteerApplicationRejectedHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Volunteer application rejected email sent to ${to}`);
  }

  async sendRegistrationPendingPaymentReminderEmail(
    to: string,
    data: RegistrationReminderEmailData,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Complete your registration — ${data.eventName}`,
      html: renderRegistrationPendingPaymentReminderHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(
      `Registration pending-payment reminder email sent to ${to}`,
    );
  }

  async sendStudentRegistrationPendingEmail(
    to: string,
    data: StudentReviewAttendeeEmailData,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Your registration is under review — ${data.eventName}`,
      html: renderStudentRegistrationPendingHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Student registration pending-review email sent to ${to}`);
  }

  async sendStudentRegistrationRejectedEmail(
    to: string,
    data: StudentReviewAttendeeEmailData,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Update on your registration — ${data.eventName}`,
      html: renderStudentRegistrationRejectedHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Student registration rejected email sent to ${to}`);
  }

  async sendStudentReviewAdminNotifyEmail(
    to: string,
    data: StudentReviewAdminNotifyEmailData,
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `New student ticket awaiting review — ${data.eventName}`,
      html: renderStudentReviewAdminNotifyHtml(data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Student review admin-notify email sent to ${to}`);
  }

  async sendTicketLifecycleEmail(
    to: string,
    kind: TicketLifecycleKind,
    data: TicketLifecycleEmailData,
  ) {
    const subjects: Record<TicketLifecycleKind, string> = {
      voided: `Your ticket has been voided — ${data.eventName}`,
      restored: `Your ticket is valid again — ${data.eventName}`,
      withdrawn: `Your ticket has been withdrawn — ${data.eventName}`,
    };
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: subjects[kind],
      html: renderTicketLifecycleEmailHtml(kind, data),
      attachments: this.brandLogoAttachment(),
    });
    this.logger.log(`Ticket ${kind} email sent to ${to}`);
  }

  async sendBroadcastEmail(
    to: string,
    data: BroadcastBodyData & {
      subject: string;
      eventName: string;
      supportEmail: string;
      // Admin broadcasts only; the automatic WhatsApp invite has none.
      unsubscribe?: UnsubscribeLinks;
    },
  ) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: data.subject,
      html: renderEmailShell({
        eventName: data.eventName,
        bodyHtml: renderBroadcastBodyHtml(data),
        supportEmail: data.supportEmail,
        unsubscribeUrl: data.unsubscribe?.pageUrl,
      }),
      attachments: this.brandLogoAttachment(),
      // Lets Gmail/Yahoo show their own "Unsubscribe" button, which POSTs
      // straight to the URL (RFC 8058) — people use that instead of
      // "Report spam", which is what hurts deliverability.
      headers: data.unsubscribe && {
        'List-Unsubscribe': `<${data.unsubscribe.oneClickUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    this.logger.log(`Broadcast email sent to ${to}`);
  }

  // The certificate of participation, with the attendee's name on it,
  // attached as a PDF.
  async sendCertificateEmail(
    to: string,
    data: { recipientName: string; eventName: string; supportEmail: string },
  ) {
    const pdf = await generateCertificatePdf(data.recipientName);
    const eventName = escapeHtml(data.eventName);
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Your certificate of participation — ${data.eventName}`,
      html: renderEmailShell({
        eventName,
        supportEmail: data.supportEmail,
        bodyHtml:
          `<p style="margin:0 0 12px;font-size:16px;">Hi ${escapeHtml(data.recipientName)},</p>` +
          `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Thank you for being part of <strong>${eventName}</strong>. Your certificate of participation is attached to this email as a PDF.</p>` +
          `<p style="margin:0;font-size:16px;line-height:1.5;">We hope to see you again next year!</p>`,
      }),
      attachments: [
        ...this.brandLogoAttachment(),
        {
          filename: 'certificate-of-participation.pdf',
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    });
    this.logger.log(`Certificate email sent to ${to}`);
  }
}
