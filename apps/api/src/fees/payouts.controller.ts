import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser, PlatformAdminOnly } from '../auth/decorators';
import { OnboardingService } from '../schools/onboarding.service';
import { FEATURES } from '../schools/rules';
import { ListPayoutsQuery, PaidDto, PayoutDto, RejectDto } from './dto';
import { PayoutsService } from './payouts.service';

@Controller()
export class PayoutsController {
  constructor(
    private readonly payouts: PayoutsService,
    private readonly onboarding: OnboardingService,
  ) {}

  private async school(
    userId: string,
    schoolId: string,
    action: 'read' | 'collect',
  ) {
    await this.onboarding.assertSchoolAdmin(userId, schoolId);
    const { access, denial } = await this.onboarding.can(
      schoolId,
      action,
      FEATURES.FEE_PAYMENTS,
    );
    if (!access) throw new ForbiddenException(denial);
  }

  @Get('schools/:schoolId/fees/payouts')
  async list(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    await this.school(u.id, s, 'read');
    return this.payouts.listPayouts(s);
  }

  @Post('schools/:schoolId/fees/payouts')
  async request(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: PayoutDto,
  ) {
    await this.school(u.id, s, 'collect');
    return this.payouts.requestPayout(s, u.id, dto);
  }

  @PlatformAdminOnly()
  @Get('platform/payouts')
  listAll(@Query() q: ListPayoutsQuery) {
    return this.payouts.listAll(q.status);
  }

  @PlatformAdminOnly()
  @Post('platform/payouts/:id/paid')
  @HttpCode(200)
  paid(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: PaidDto,
  ) {
    return this.payouts.markPaid(id, u.id, dto.providerRef);
  }

  @PlatformAdminOnly()
  @Post('platform/payouts/:id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectDto,
  ) {
    return this.payouts.reject(id, u.id, dto.reason);
  }
}
