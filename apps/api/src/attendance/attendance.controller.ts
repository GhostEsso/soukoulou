import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { OnboardingService } from '../schools/onboarding.service';
import { AttendanceService } from './attendance.service';
import { RollCallDto } from './dto';

@Controller('schools/:schoolId/attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly onboarding: OnboardingService,
  ) {}

  @Get()
  async roster(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query('classroomId') classroomId: string,
    @Query('day') day?: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.attendance.roster(s, classroomId ?? '', day);
  }

  @Get('week')
  async week(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query('day') day?: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.attendance.week(s, day);
  }

  @Get('student/:studentId')
  async student(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('studentId') studentId: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.attendance.student(s, studentId);
  }

  @Put()
  async save(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: RollCallDto,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.attendance.save(s, u.id, dto);
  }
}
