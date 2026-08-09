import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma/prisma.service';

const logger = new Logger('BootstrapAdmin');

// Fill these in with the real super_admin credentials before pushing to
// production, then revert this file (or at least blank the password back
// out) once the account exists — it's only read on the one boot where
// admin_users is empty, and it sits in plaintext in git history otherwise.
const BOOTSTRAP_ADMIN_NAME: string = 'Yusuf Abdullahi';
const BOOTSTRAP_ADMIN_EMAIL: string = 'yusufabdullahi@2910.com';
const BOOTSTRAP_ADMIN_PASSWORD: string = 'Yusasive2910@';

// Runs on every boot (see main.ts). A brand-new deploy has zero rows in
// admin_users, and POST /admin/users itself requires an existing
// super_admin (see AdminController) — so nothing in the app can create the
// first account. This closes that gap without any new infra: the very
// first successful boot against an empty admin_users table creates one
// super_admin from the constants above. Every boot after that is a no-op,
// since the count check is no longer zero — safe to leave this file in
// place (though you should still blank the password out once it's used).
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

  const existingAdminCount = await prisma.adminUser.count();
  if (existingAdminCount > 0) return;

  try {
    await prisma.adminUser.create({
      data: {
        name: BOOTSTRAP_ADMIN_NAME,
        email: BOOTSTRAP_ADMIN_EMAIL,
        passwordHash: await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 10),
        role: 'super_admin',
      },
    });
  } catch (err) {
    // Unique violation on email: another instance (or a manually created
    // row) won the race — nothing left to do.
    logger.warn(`Skipped super_admin bootstrap: ${String(err)}`);
    return;
  }

  logger.log(
    `Bootstrapped first super_admin (${BOOTSTRAP_ADMIN_EMAIL}) — log in and rotate this password, then blank BOOTSTRAP_ADMIN_PASSWORD in bootstrap-admin.ts`,
  );
}
