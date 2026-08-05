import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { NewsletterController } from './newsletter.controller';
import { NewsletterExportQueue } from './newsletter-export.queue';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [EmailModule],
  controllers: [NewsletterController],
  providers: [NewsletterService, NewsletterExportQueue],
  exports: [NewsletterService, NewsletterExportQueue],
})
export class NewsletterModule {}
