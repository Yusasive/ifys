import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { FeedbackModule } from './feedback/feedback.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { BroadcastsModule } from './broadcasts/broadcasts.module';
import { CouponsModule } from './coupons/coupons.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { PaymentsModule } from './payments/payments.module';
import { SpeakersModule } from './speakers/speakers.module';
import { SponsorsModule } from './sponsors/sponsors.module';
import { TagsModule } from './tags/tags.module';
import { CertificatesModule } from './certificates/certificates.module';
import { TicketsModule } from './tickets/tickets.module';
import { VolunteersModule } from './volunteers/volunteers.module';
import { CheckInsModule } from './check-ins/check-ins.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { configValidationSchema } from './config-validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    ThrottlerModule.forRoot({
      throttlers: [{ limit: 300, ttl: 60_000 }],
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    AuditLogModule,
    AuthModule,
    CouponsModule,
    RegistrationsModule,
    PaymentsModule,
    SpeakersModule,
    SponsorsModule,
    NewsletterModule,
    TicketsModule,
    VolunteersModule,
    CheckInsModule,
    AdminModule,
    BroadcastsModule,
    TagsModule,
    CertificatesModule,
    FeedbackModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
