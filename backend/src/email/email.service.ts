import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  // Read once at startup rather than per-send — the file never changes at
  // runtime, and every outgoing email attaches it as the cid:brand-logo
  // image referenced by email-shell.ts's <img> tag.
  private readonly logoBuffer: Buffer | null;

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('SMTP_FROM');
    const port = Number(config.getOrThrow<string>('SMTP_PORT'));
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');

    this.transporter = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port,
      // 465 is SMTPS (implicit TLS); everything else (587, Mailpit's 1025)
      // negotiates TLS via STARTTLS or runs unencrypted for local dev.
      secure: port === 465,
      auth: user && password ? { user, pass: password } : undefined,
    });

    try {
      this.logoBuffer = readFileSync(join(__dirname, 'assets', 'logo.png'));
    } catch (err) {
      // A missing logo asset must not take down transactional email — the
      // shell's <img> just renders broken, which is recoverable, unlike a
      // failed ticket/confirmation send.
      this.logger.warn(`Could not load brand logo asset: ${String(err)}`);
      this.logoBuffer = null;
    }
  }

  private brandLogoAttachment(): Attachment[] {
    if (!this.logoBuffer) return [];
    return [
      { filename: 'logo.png', content: this.logoBuffer, cid: 'brand-logo' },
    ];
  }

  async sendTicketEmail(to: string, data: TicketEmailData, qrPayload: string) {
    const qrPngBuffer = await QRCode.toBuffer(qrPayload, {
      width: 360,
      margin: 1,
    });
    const pdfBuffer = await generateTicketPdf(data, qrPngBuffer);

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Your ticket — ${data.eventName}`,
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
}
