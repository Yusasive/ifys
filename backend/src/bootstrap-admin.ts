import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma/prisma.service';

const logger = new Logger('BootstrapAdmin');

const BOOTSTRAP_ADMIN_NAME: string = 'Yusuf Abdullahi';
const BOOTSTRAP_ADMIN_EMAIL: string = 'yusufabdullahi2910@gmail.com';
const BOOTSTRAP_ADMIN_PASSWORD: string = 'Yusasive2910@';

export async function bootstrapSuperAdminIfNeeded(app: INestApplication) {
  if (
    BOOTSTRAP_ADMIN_EMAIL === 'CHANGE_ME@example.com' ||
    BOOTSTRAP_ADMIN_PASSWORD === 'CHANGE_ME'
  ) {
    return;
  }
  if (BOOTSTRAP_ADMIN_PASSWORD.length < 12) {
    logger.error(
      'BOOTSTRAP_ADMIN_PASSWORD is set but shorter than 12 characters — refusing to create the account',
    );
    return;
  }

  const prisma = app.get(PrismaService);

  const email = BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();

  try {
    const existing = await prisma.adminUser.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) return;

    await prisma.adminUser.create({
      data: {
        name: BOOTSTRAP_ADMIN_NAME,
        email,
        passwordHash: await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 10),
        role: 'super_admin',
      },
    });
    logger.log(
      `Bootstrapped first super_admin (${BOOTSTRAP_ADMIN_EMAIL}) — log in and rotate this password, then blank BOOTSTRAP_ADMIN_PASSWORD in bootstrap-admin.ts`,
    );
  } catch (err) {
    logger.warn(`Skipped super_admin bootstrap: ${String(err)}`);
  }
}
