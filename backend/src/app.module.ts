import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { PaymentsModule } from './payments/payments.module';
import { TicketsModule } from './tickets/tickets.module';
import { CheckInsModule } from './check-ins/check-ins.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // M6 load check: 60/min per IP throttled a burst of legitimate
    // distinct users sharing one IP (e.g. campus/office WiFi NAT) — real
    // for this event's audience. Raised to 300/min as the app-wide
    // default; /checkin/scan keeps its own much stricter 20/min
    // override, since that limit exists to blunt short-code
    // brute-forcing, not to manage load.
    ThrottlerModule.forRoot({
      throttlers: [{ limit: 300, ttl: 60_000 }],
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    AuditLogModule,
    AuthModule,
    RegistrationsModule,
    PaymentsModule,
    TicketsModule,
    CheckInsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
