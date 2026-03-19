import { Controller, Post, Get, Patch, Body, UseGuards, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const COOKIE_NAME = 'access_token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken } = await this.authService.register(dto);
    res.cookie(COOKIE_NAME, accessToken, COOKIE_OPTS);
    return { ok: true };
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken } = await this.authService.login(dto);
    res.cookie(COOKIE_NAME, accessToken, COOKIE_OPTS);
    return { ok: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getProfile(@CurrentUser() user: { userId: string }) {
    return this.authService.getProfile(user.userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateProfile(
    @CurrentUser() user: { userId: string },
    @Body() dto: { smtpHost?: string; smtpPort?: number; smtpUser?: string; smtpPass?: string },
  ) {
    return this.authService.updateProfile(user.userId, dto);
  }
}
