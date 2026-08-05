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
import { AuthService } from './auth.service';
import { CSRF_COOKIE } from './csrf.guard';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import {
  JwtAuthGuard,
  SESSION_COOKIE,
  type AuthenticatedRequest,
} from './jwt-auth.guard';
import type { JwtPayload } from './jwt-payload';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Brute-force guard on the one endpoint that lets an attacker test
  // admin passwords — same pattern as check-ins' scan-code throttle.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);
    const isProd = this.config.get('NODE_ENV') === 'production';

    res.cookie(SESSION_COOKIE, result.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresInSeconds * 1000,
    });
    // Readable by frontend JS on purpose — double-submit CSRF pattern.
    res.cookie(CSRF_COOKIE, result.csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresInSeconds * 1000,
    });

    return { user: result.user };
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
    res.clearCookie(CSRF_COOKIE, { path: '/' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return {
      user: {
        id: user.sub,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
