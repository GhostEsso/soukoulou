import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { OnboardingService } from '../schools/onboarding.service';
import { AssignmentsDto, TeacherDto, TeacherQuery } from './dto';
import { TeachersService } from './teachers.service';

@Controller('schools/:schoolId/teachers')
export class TeachersController {
  constructor(
    private readonly teachers: TeachersService,
    private readonly onboarding: OnboardingService,
  ) {}

  private admin(u: AuthUser, s: string) {
    return this.onboarding.assertSchoolAdmin(u.id, s);
  }

  @Get()
  async list(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query() q: TeacherQuery,
  ) {
    await this.admin(u, s);
    return this.teachers.list(s, q);
  }

  @Get('count')
  async count(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    await this.admin(u, s);
    return this.teachers.count(s);
  }

  @Get('assignments')
  async assignments(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    await this.admin(u, s);
    return this.teachers.assignments(s);
  }

  @Get(':id')
  async get(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.teachers.get(s, id);
  }

  @Post()
  async create(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: TeacherDto,
  ) {
    await this.admin(u, s);
    return this.teachers.create(s, dto);
  }

  @Patch(':id')
  @HttpCode(204)
  async update(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: TeacherDto,
  ) {
    await this.admin(u, s);
    await this.teachers.update(s, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    await this.teachers.remove(s, id);
  }

  @Put(':id/photo')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1_048_576, files: 1 } }),
  )
  async setPhoto(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    await this.admin(u, s);
    return this.teachers.setPhoto(s, id, file);
  }

  @Delete(':id/photo')
  @HttpCode(204)
  async removePhoto(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    await this.teachers.removePhoto(s, id);
  }

  @Get(':id/photo')
  async photo(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    const p = await this.teachers.openPhoto(s, id, u.id);
    return new StreamableFile(p.stream, { type: p.contentType });
  }

  @Post(':id/access')
  async createAccess(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.teachers.createAccess(s, id);
  }

  @Post(':id/access/reset')
  async resetAccess(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.teachers.resetAccess(s, id);
  }

  @Delete(':id/access')
  @HttpCode(204)
  async removeAccess(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    await this.teachers.removeAccess(s, id);
  }

  @Put(':id/assignments/:classroomId')
  async assign(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Param('classroomId') classroomId: string,
    @Body() dto: AssignmentsDto,
  ) {
    await this.admin(u, s);
    return this.teachers.setAssignments(s, id, classroomId, dto);
  }
}
