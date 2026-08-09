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
const BOOTSTRAP_ADMIN_EMAIL: string = 'yusufabdullahi2910@gmail.com';
const BOOTSTRAP_ADMIN_PASSWORD: string = 'Yusasive2910@';

// Runs on every boot (see main.ts). POST /admin/users itself requires an
// existing super_admin (see AdminController) — so nothing in the app can
// create the very first account. This closes that gap without any new
// infra: on boot, if BOOTSTRAP_ADMIN_EMAIL doesn't already have a row,
// create one from the constants above. Gated on that specific email,
// not on admin_users being empty overall — an unrelated row (a dev seed
// run against this DB, an earlier partial attempt) must not block this
// account from ever getting created. Once the row exists, every later
// boot is a no-op — safe to leave this file in place (though you should
// still blank the password out once it's used).
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

  // Never let a bootstrap hiccup (a transient DB error, a unique-violation
  // race with another instance, anything) block the app from starting —
  // this whole function only ever runs before app.listen() in main.ts, so
  // an uncaught rejection here would crash the process before it can even
  // serve a health check.
  try {
    const existing = await prisma.adminUser.findUnique({
      where: { email: BOOTSTRAP_ADMIN_EMAIL },
    });
    if (existing) return;

    await prisma.adminUser.create({
      data: {
        name: BOOTSTRAP_ADMIN_NAME,
        email: BOOTSTRAP_ADMIN_EMAIL,
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
