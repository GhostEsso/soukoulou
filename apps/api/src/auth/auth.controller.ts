import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import type { AuthUser } from './decorators';
import { CurrentUser, Public } from './decorators';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  ResetPasswordDto,
  SignupSchoolDto,
  TokenDto,
} from './dto';

const STRICT = { default: { ttl: 60_000, limit: 10 } };

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ponytail: pas encore de captcha. À ajouter devant cette route avant la mise en ligne.
  @Public()
  @Throttle(STRICT)
  @Post('public/schools/signup')
  signup(@Body() dto: SignupSchoolDto) {
    return this.auth.signupSchool(dto);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('auth/verify-email')
  verifyEmail(@Body() dto: TokenDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.identifier, dto.password);
  }

  @Public()
  @HttpCode(200)
  @Post('auth/refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(204)
  @Post('auth/logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(204)
  @Post('auth/forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(204)
  @Post('auth/reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Throttle(STRICT)
  @HttpCode(200)
  @Post('auth/change-password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user.id, dto.current, dto.password);
  }

  @Get('auth/me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
