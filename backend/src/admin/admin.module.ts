import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ExportQueue } from './export.queue';

@Module({
  imports: [AuthModule, TicketsModule, EmailModule],
  controllers: [AdminController],
  providers: [AdminService, ExportQueue],
})
export class AdminModule {}
