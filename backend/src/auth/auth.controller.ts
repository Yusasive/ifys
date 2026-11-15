import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService, LoginResult } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import {
  JwtAuthGuard,
  SESSION_COOKIE,
  type AuthenticatedRequest,
} from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setSessionCookie(res: Response, result: LoginResult) {
    const isProd = this.config.get('NODE_ENV') === 'production';
    res.cookie(SESSION_COOKIE, result.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresInSeconds * 1000,
    });
  }

  // Brute-force guard on the one endpoint that lets an attacker test
  // admin passwords — same pattern as check-ins' scan-code throttle.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);
    this.setSessionCookie(res, result);

    return { user: result.user, csrfToken: result.csrfToken };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    this.setSessionCookie(res, result);
    return { user: result.user, csrfToken: result.csrfToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const exp = req.user.exp ?? Math.floor(Date.now() / 1000);
    await this.auth.logout(req.user.jti, exp);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedRequest['user']) {
    return {
      user: {
        id: user.sub,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        permissions: user.permissions,
      },
      csrfToken: user.csrf,
    };
  }
}
