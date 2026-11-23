import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { OnboardingService } from '../schools/onboarding.service';
import {
  AssessmentDto,
  AssessmentQuery,
  CouncilDto,
  GradesDto,
  PerformanceQuery,
  ReportCardQuery,
} from './dto';
import { GradesService } from './grades.service';

@Controller('schools/:schoolId/assessments')
export class GradesController {
  constructor(
    private readonly grades: GradesService,
    private readonly onboarding: OnboardingService,
  ) {}

  private admin(u: AuthUser, s: string) {
    return this.onboarding.assertSchoolAdmin(u.id, s);
  }

  @Get()
  async list(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query() q: AssessmentQuery,
  ) {
    await this.admin(u, s);
    return this.grades.list(s, q);
  }

  @Get('performance')
  async performance(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query() q: PerformanceQuery,
  ) {
    await this.admin(u, s);
    return this.grades.performance(s, q.teacherId);
  }

  @Get('report-cards')
  async reportCards(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query() q: ReportCardQuery,
  ) {
    await this.admin(u, s);
    return this.grades.reportCards(s, q.classroomId, q.periodId);
  }

  @Get('student/:studentId')
  async student(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('studentId') studentId: string,
  ) {
    await this.admin(u, s);
    return this.grades.studentReport(s, studentId);
  }

  @Get(':id')
  async get(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.grades.get(s, id);
  }

  @Post()
  async create(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: AssessmentDto,
  ) {
    await this.admin(u, s);
    return this.grades.create(s, dto);
  }

  @Put('council')
  @HttpCode(204)
  async council(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: CouncilDto,
  ) {
    await this.admin(u, s);
    await this.grades.saveCouncil(s, dto);
  }

  @Put(':id/grades')
  async save(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: GradesDto,
  ) {
    await this.admin(u, s);
    return this.grades.saveGrades(s, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    await this.grades.remove(s, id);
  }
}
