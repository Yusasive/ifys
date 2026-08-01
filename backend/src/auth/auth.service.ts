import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.adminUser.findUnique({
      where: { email: dto.email },
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

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
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
}
