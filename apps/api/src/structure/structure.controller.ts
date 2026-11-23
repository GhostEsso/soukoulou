import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { OnboardingService } from '../schools/onboarding.service';
import {
  ClassroomDto,
  LevelSubjectsDto,
  NameDto,
  OrderDto,
  SubjectDto,
  UpdateClassroomDto,
  UpdateSubjectDto,
  UpdateYearDto,
  YearDto,
} from './dto';
import { StructureService } from './structure.service';

@Controller('schools/:schoolId/structure')
export class StructureController {
  constructor(
    private readonly structure: StructureService,
    private readonly onboarding: OnboardingService,
  ) {}

  private admin(user: AuthUser, schoolId: string) {
    return this.onboarding.assertSchoolAdmin(user.id, schoolId);
  }

  @Get()
  async overview(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    await this.admin(u, s);
    return this.structure.overview(s);
  }

  @Post('years')
  async createYear(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: YearDto,
  ) {
    await this.admin(u, s);
    return this.structure.createYear(s, dto);
  }

  @Patch('years/:id')
  async updateYear(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: UpdateYearDto,
  ) {
    await this.admin(u, s);
    return this.structure.updateYear(s, id, dto);
  }

  @Delete('years/:id')
  async deleteYear(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.structure.deleteYear(s, id);
  }

  @Post('levels')
  async createLevel(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: NameDto,
  ) {
    await this.admin(u, s);
    return this.structure.createLevel(s, dto.name);
  }

  @Put('levels/order')
  async orderLevels(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: OrderDto,
  ) {
    await this.admin(u, s);
    return this.structure.orderLevels(s, dto.ids);
  }

  @Patch('levels/:id')
  async renameLevel(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: NameDto,
  ) {
    await this.admin(u, s);
    return this.structure.renameLevel(s, id, dto.name);
  }

  @Delete('levels/:id')
  async deleteLevel(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.structure.deleteLevel(s, id);
  }

  @Put('levels/:id/subjects')
  async setLevelSubjects(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: LevelSubjectsDto,
  ) {
    await this.admin(u, s);
    return this.structure.setLevelSubjects(s, id, dto);
  }

  @Post('subjects')
  async createSubject(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: SubjectDto,
  ) {
    await this.admin(u, s);
    return this.structure.createSubject(s, dto);
  }

  @Patch('subjects/:id')
  async updateSubject(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    await this.admin(u, s);
    return this.structure.updateSubject(s, id, dto);
  }

  @Delete('subjects/:id')
  async deleteSubject(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.structure.deleteSubject(s, id);
  }

  @Post('classrooms')
  async createClassroom(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: ClassroomDto,
  ) {
    await this.admin(u, s);
    return this.structure.createClassroom(s, dto);
  }

  @Patch('classrooms/:id')
  async updateClassroom(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: UpdateClassroomDto,
  ) {
    await this.admin(u, s);
    return this.structure.updateClassroom(s, id, dto);
  }

  @Delete('classrooms/:id')
  async deleteClassroom(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.structure.deleteClassroom(s, id);
  }
}
