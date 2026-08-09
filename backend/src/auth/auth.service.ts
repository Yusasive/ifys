import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload';

export interface LoginResult {
  accessToken: string;
  csrfToken: string;
  expiresInSeconds: number;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
  };
}

function denylistKey(jti: string) {
  return `jwt:denylist:${jti}`;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    // Case-insensitive: LoginDto normalizes the typed email to lowercase,
    // but a row created before that normalization existed (or created with
    // stray casing some other way) may still be stored mixed-case —
    // findUnique would exact-match-fail against it forever otherwise.
    const user = await this.prisma.adminUser.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });
    // Deliberately identical error for "no such user" and "wrong password"
    // — don't let the login endpoint reveal which admin emails exist.
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.mintSession(user);
  }

  // Shared by login and changePassword — both need to sign a fresh JWT for
  // a given AdminUser row and shape it into the same response contract.
  private async mintSession(user: {
    id: string;
    name: string;
    email: string;
    role: JwtPayload['role'];
    tokenVersion: number;
    mustChangePassword: boolean;
  }): Promise<LoginResult> {
    const csrfToken = randomBytes(32).toString('hex');
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      jti: randomUUID(),
      tv: user.tokenVersion,
      csrf: csrfToken,
      mustChangePassword: user.mustChangePassword,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const decoded = this.jwt.decode<{ exp: number }>(accessToken);
    const expiresInSeconds = decoded.exp - Math.floor(Date.now() / 1000);

    return {
      accessToken,
      csrfToken,
      expiresInSeconds,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  // Denylists the current token's jti until it would have expired anyway —
  // no point keeping it around longer than the JWT itself is valid for.
  async logout(jti: string, expiresAt: number): Promise<void> {
    const ttlSeconds = expiresAt - Math.floor(Date.now() / 1000);
    if (ttlSeconds <= 0) return;
    await this.redis.set(denylistKey(jti), '1', 'EX', ttlSeconds);
  }

  async isDenylisted(jti: string): Promise<boolean> {
    const value = await this.redis.get(denylistKey(jti));
    return value !== null;
  }

  // Force-invalidates every token issued for this user (e.g. suspected
  // compromise, or role/password change) by bumping the version every
  // valid token must match against.
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  // Used by the void action's re-auth step (TRD §10: short-lived sessions
  // plus a re-auth step for destructive actions).
  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });
    if (!user) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  // Self-service password change — used both for the forced first-login
  // flow (mustChangePassword) and a voluntary change later. Bumps
  // tokenVersion (invalidates every other outstanding session for this
  // user, e.g. one left signed in on another device with the old
  // password) and immediately mints a replacement so the caller's own
  // session keeps working instead of being logged out by its own request.
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<LoginResult> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });

    return this.mintSession(updated);
  }
}
