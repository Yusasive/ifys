import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload';
import { getEffectivePermissions, PermissionKey } from './permissions';

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
    permissions: PermissionKey[];
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
    const user = await this.prisma.adminUser.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' } },
    });

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

  private async mintSession(user: {
    id: string;
    name: string;
    email: string;
    role: JwtPayload['role'];
    tokenVersion: number;
    mustChangePassword: boolean;
    permissions: string[];
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
        permissions: getEffectivePermissions(user),
      },
    };
  }

  async logout(jti: string, expiresAt: number): Promise<void> {
    const ttlSeconds = expiresAt - Math.floor(Date.now() / 1000);
    if (ttlSeconds <= 0) return;
    await this.redis.set(denylistKey(jti), '1', 'EX', ttlSeconds);
  }

  async isDenylisted(jti: string): Promise<boolean> {
    const value = await this.redis.get(denylistKey(jti));
    return value !== null;
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async verifyPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });
    if (!user) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

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
