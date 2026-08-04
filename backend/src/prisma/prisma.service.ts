import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    // RDS's cert chain isn't in Node's default trust store, and passing
    // sslmode query params alone doesn't reliably disable verification
    // through this adapter — set it directly instead. Only kicks in when
    // the URL opts into SSL, so local/Docker Postgres (no sslmode) is
    // unaffected.
    const useSsl = connectionString?.includes('sslmode=require') ?? false;
    super({
      adapter: new PrismaPg({
        connectionString,
        ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
