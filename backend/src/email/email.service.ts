import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import * as QRCode from 'qrcode';
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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

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
  }

  async sendTicketEmail(to: string, data: TicketEmailData, qrPayload: string) {
    const qrPngBuffer = await QRCode.toBuffer(qrPayload, {
      width: 360,
      margin: 1,
    });

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `Your ticket — ${data.eventName}`,
      html: renderTicketEmailHtml(data),
      attachments: [
        {
          filename: 'ticket-qr.png',
          content: qrPngBuffer,
          cid: 'ticket-qr',
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
    });
    this.logger.log(`Sponsor application rejected email sent to ${to}`);
  }

  async sendNewsletterConfirmationEmail(to: string, data: NewsletterEmailData) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `You're subscribed for updates`,
      html: renderNewsletterConfirmationHtml(data),
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
    });
    this.logger.log(`Volunteer application approved email sent to ${to}`);
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
    });
    this.logger.log(`Volunteer application rejected email sent to ${to}`);
  }
}
