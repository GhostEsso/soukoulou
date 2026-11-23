import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { OnboardingService } from '../schools/onboarding.service';
import { SlotDto, SlotQuery } from './dto';
import { ScheduleService } from './schedule.service';

@Controller('schools/:schoolId/schedule')
export class ScheduleController {
  constructor(
    private readonly schedule: ScheduleService,
    private readonly onboarding: OnboardingService,
  ) {}

  @Get()
  async list(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query() q: SlotQuery,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.schedule.list(s, q);
  }

  @Post()
  async create(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: SlotDto,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.schedule.create(s, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    await this.schedule.remove(s, id);
  }
}
