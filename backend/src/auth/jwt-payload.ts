import { AdminRole } from '../generated/prisma/enums';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: AdminRole;
}
