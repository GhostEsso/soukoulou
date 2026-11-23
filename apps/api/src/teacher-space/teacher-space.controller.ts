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
import { AttendanceService } from '../attendance/attendance.service';
import { RollCallDto } from '../attendance/dto';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { AssessmentDto, GradesDto } from '../grades/dto';
import { GradesService } from '../grades/grades.service';
import { TeacherSpaceService } from './teacher-space.service';

/** Ce que voit un enseignant connecté : ses cours, l'appel et les notes de ses classes. */
@Controller('schools/:schoolId/teacher')
export class TeacherSpaceController {
  constructor(
    private readonly space: TeacherSpaceService,
    private readonly attendance: AttendanceService,
    private readonly grades: GradesService,
  ) {}

  @Get()
  home(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    return this.space.home(u.id, s);
  }

  @Get('attendance')
  async roster(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query('classroomId') classroomId = '',
    @Query('day') day?: string,
  ) {
    await this.space.assertTeaches(u.id, s, classroomId);
    return this.attendance.roster(s, classroomId, day);
  }

  @Put('attendance')
  async rollCall(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: RollCallDto,
  ) {
    await this.space.assertTeaches(u.id, s, dto.classroomId);
    return this.attendance.save(s, u.id, dto);
  }

  /** Ses évaluations : celles de ses matières dans ses classes. */
  @Get('assessments')
  async assessments(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query('classroomId') classroomId?: string,
  ) {
    const me = await this.space.whoami(u.id, s);
    const mine = new Set(
      me.teachings.map((t) => `${t.classroom.id}:${t.subject.id}`),
    );
    const rows = await this.grades.list(s, { classroomId });
    return rows.filter((a) => mine.has(`${a.classroom.id}:${a.subject.id}`));
  }

  @Post('assessments')
  async create(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: AssessmentDto,
  ) {
    await this.space.assertTeaches(u.id, s, dto.classroomId, dto.subjectId);
    return this.grades.create(s, dto);
  }

  @Get('assessments/:id')
  async get(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.space.assertAssessment(u.id, s, id);
    return this.grades.get(s, id);
  }

  @Put('assessments/:id/grades')
  async saveGrades(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: GradesDto,
  ) {
    await this.space.assertAssessment(u.id, s, id);
    return this.grades.saveGrades(s, id, dto);
  }

  @Delete('assessments/:id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.space.assertAssessment(u.id, s, id);
    await this.grades.remove(s, id);
  }
}
