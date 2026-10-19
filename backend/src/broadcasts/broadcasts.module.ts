import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { BroadcastsController } from './broadcasts.controller';
import { BroadcastsService } from './broadcasts.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [BroadcastsController],
  providers: [BroadcastsService],
})
export class BroadcastsModule {}
