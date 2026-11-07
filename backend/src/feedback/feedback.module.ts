import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  AdminFeedbackController,
  FeedbackController,
} from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [AuthModule],
  controllers: [FeedbackController, AdminFeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
