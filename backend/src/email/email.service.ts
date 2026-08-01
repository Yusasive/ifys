import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import * as QRCode from 'qrcode';
import {
  renderTicketEmailHtml,
  TicketEmailData,
} from './ticket-email-template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('SMTP_FROM');
    this.transporter = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: Number(config.getOrThrow<string>('SMTP_PORT')),
      secure: false,
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
}
