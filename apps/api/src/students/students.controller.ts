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
import { StudentDto, StudentQuery, UpdateStudentDto } from './dto';
import { StudentsService } from './students.service';

@Controller('schools/:schoolId/students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly onboarding: OnboardingService,
  ) {}

  @Get()
  async list(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query() q: StudentQuery,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.students.list(s, q);
  }

  @Get('stats')
  async stats(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query('yearId') yearId?: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.students.stats(s, yearId);
  }

  @Get(':id')
  async get(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.students.get(s, id);
  }

  @Post()
  async create(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: StudentDto,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.students.create(s, dto);
  }

  @Patch(':id')
  @HttpCode(204)
  async update(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    await this.students.update(s, id, dto);
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
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.students.setPhoto(s, id, file);
  }

  @Delete(':id/photo')
  @HttpCode(204)
  async removePhoto(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    await this.students.removePhoto(s, id);
  }

  @Get(':id/photo')
  async photo(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    const p = await this.students.openPhoto(s, id, u.id);
    return new StreamableFile(p.stream, { type: p.contentType });
  }

  @Post(':id/access')
  async createAccess(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.students.createAccess(s, id);
  }

  @Post(':id/access/reset')
  async resetAccess(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    return this.students.resetAccess(s, id);
  }

  @Delete(':id/access')
  @HttpCode(204)
  async removeAccess(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    await this.students.removeAccess(s, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.onboarding.assertSchoolAdmin(u.id, s);
    await this.students.remove(s, id);
  }
}
