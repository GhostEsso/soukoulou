import {
  Body,
  Controller,
  Delete,
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
import { ParentDto, ParentQuery } from './dto';
import { ParentsService } from './parents.service';

@Controller('schools/:schoolId/parents')
export class ParentsController {
  constructor(
    private readonly parents: ParentsService,
    private readonly onboarding: OnboardingService,
  ) {}

  private admin(u: AuthUser, s: string) {
    return this.onboarding.assertSchoolAdmin(u.id, s);
  }

  @Get()
  async list(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Query() q: ParentQuery,
  ) {
    await this.admin(u, s);
    return this.parents.list(s, q);
  }

  @Get(':id')
  async get(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.parents.get(s, id);
  }

  @Post()
  async create(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Body() dto: ParentDto,
  ) {
    await this.admin(u, s);
    return this.parents.create(s, dto);
  }

  @Patch(':id')
  @HttpCode(204)
  async update(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
    @Body() dto: ParentDto,
  ) {
    await this.admin(u, s);
    await this.parents.update(s, id, dto);
  }

  @Post(':id/access')
  async createAccess(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.parents.createAccess(s, id);
  }

  @Post(':id/access/reset')
  async resetAccess(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    return this.parents.resetAccess(s, id);
  }

  @Delete(':id/access')
  @HttpCode(204)
  async removeAccess(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    await this.parents.removeAccess(s, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('id') id: string,
  ) {
    await this.admin(u, s);
    await this.parents.remove(s, id);
  }
}
