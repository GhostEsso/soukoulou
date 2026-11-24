import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { OnboardingService } from '../schools/onboarding.service';
import { FEATURES } from '../schools/rules';
import { ScheduleDto } from './dto';
import { FeesService } from './fees.service';

/** Grille des frais de scolarité : réservée à l'administration de l'école. */
@Controller('schools/:schoolId/fees/schedules')
export class FeesController {
  constructor(
    private readonly fees: FeesService,
    private readonly onboarding: OnboardingService,
  ) {}

  private async admin(userId: string, schoolId: string, write = false) {
    await this.onboarding.assertSchoolAdmin(userId, schoolId);
    if (!write) return;
    const { access, denial } = await this.onboarding.can(
      schoolId,
      'write',
      FEATURES.CASHBOX,
    );
    if (!access) throw new ForbiddenException(denial);
  }

  @Get()
  async list(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query('yearId') yearId: string,
  ) {
    await this.admin(u.id, s);
    return this.fees.listSchedules(s, yearId ?? '');
  }

  @Post()
  async create(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: ScheduleDto,
  ) {
    await this.admin(u.id, s, true);
    return this.fees.createSchedule(s, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: ScheduleDto,
  ) {
    await this.admin(u.id, s, true);
    return this.fees.updateSchedule(s, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u.id, s, true);
    await this.fees.deleteSchedule(s, id);
  }
}
