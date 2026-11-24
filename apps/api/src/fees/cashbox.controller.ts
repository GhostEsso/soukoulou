import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { OnboardingService } from '../schools/onboarding.service';
import { FEATURES } from '../schools/rules';
import { CashboxService } from './cashbox.service';
import type { BalanceQuery } from './cashbox.service';
import { CashDto } from './dto';

/** Caisse, soldes, reçus et tableau de bord : réservés à l'administration de l'école. */
@Controller('schools/:schoolId/fees')
export class CashboxController {
  constructor(
    private readonly cashbox: CashboxService,
    private readonly onboarding: OnboardingService,
  ) {}

  private async admin(
    userId: string,
    schoolId: string,
    gate?: { need: 'read' | 'write'; feature: string },
  ) {
    await this.onboarding.assertSchoolAdmin(userId, schoolId);
    if (!gate) return;
    const { access, denial } = await this.onboarding.can(
      schoolId,
      gate.need,
      gate.feature,
    );
    if (!access) throw new ForbiddenException(denial);
  }

  @Get('students')
  async balances(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query() q: BalanceQuery,
  ) {
    await this.admin(u.id, s);
    return this.cashbox.balances(s, q);
  }

  @Get('students/:studentId')
  async studentFee(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('studentId') studentId: string,
    @Query('yearId') yearId?: string,
  ) {
    await this.admin(u.id, s);
    return this.cashbox.studentFee(s, studentId, yearId);
  }

  @Post('payments')
  async cash(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: CashDto,
  ) {
    await this.admin(u.id, s, { need: 'write', feature: FEATURES.CASHBOX });
    return this.cashbox.recordCash(s, u.id, dto);
  }

  @Get('payments/:id/receipt')
  async receipt(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u.id, s);
    return this.cashbox.receipt(s, id);
  }

  @Get('dashboard')
  async dashboard(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query('yearId') yearId?: string,
  ) {
    await this.admin(u.id, s, {
      need: 'read',
      feature: FEATURES.FEE_TRACKING,
    });
    return this.cashbox.dashboard(s, yearId);
  }
}
