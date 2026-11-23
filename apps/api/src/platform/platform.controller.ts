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
import { CurrentUser, PlatformAdminOnly } from '../auth/decorators';
import {
  CalendarDto,
  ListSchoolsQuery,
  ListVerificationsQuery,
  MessageDto,
  ReasonDto,
  RequirementDto,
  ReviewDocumentDto,
  UpdatePlanDto,
  UpdateRequirementDto,
} from './dto';
import { PlatformService } from './platform.service';

@PlatformAdminOnly()
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('alerts')
  alerts(@Query('unread') unread?: string) {
    return this.platform.alerts(unread === 'true');
  }

  @Post('alerts/:id/read')
  @HttpCode(204)
  readAlert(@Param('id') id: string) {
    return this.platform.readAlert(id);
  }

  @Get('verifications')
  verifications(@Query() q: ListVerificationsQuery) {
    return this.platform.verifications(q.status);
  }

  @Get('verifications/:schoolId')
  verification(@Param('schoolId') schoolId: string) {
    return this.platform.verification(schoolId);
  }

  @Post('verifications/:schoolId/documents/:documentId/review')
  @HttpCode(200)
  review(
    @CurrentUser() user: AuthUser,
    @Param('schoolId') schoolId: string,
    @Param('documentId') documentId: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.platform.reviewDocument(schoolId, documentId, user.id, dto);
  }

  @Post('verifications/:schoolId/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('schoolId') schoolId: string) {
    return this.platform.approve(schoolId, user.id);
  }

  @Post('verifications/:schoolId/request-changes')
  @HttpCode(200)
  requestChanges(
    @CurrentUser() user: AuthUser,
    @Param('schoolId') schoolId: string,
    @Body() dto: MessageDto,
  ) {
    return this.platform.requestChanges(schoolId, user.id, dto.message);
  }

  @Post('verifications/:schoolId/reject')
  @HttpCode(204)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('schoolId') schoolId: string,
    @Body() dto: ReasonDto,
  ) {
    return this.platform.reject(schoolId, user.id, dto.reason);
  }

  @Get('payments/pending-transfers')
  pendingTransfers() {
    return this.platform.pendingTransfers();
  }

  @Post('payments/:id/confirm')
  @HttpCode(200)
  confirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.platform.confirmTransfer(id, user.id);
  }

  @Get('schools')
  schools(@Query() q: ListSchoolsQuery) {
    return this.platform.schools(q);
  }

  @Post('schools/:id/suspend')
  @HttpCode(204)
  suspend(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.platform.suspend(id, user.id, dto.reason);
  }

  @Post('schools/:id/reactivate')
  @HttpCode(204)
  reactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.platform.reactivate(id, user.id);
  }

  @Get('document-requirements')
  requirements() {
    return this.platform.requirements();
  }

  @Post('document-requirements')
  createRequirement(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequirementDto,
  ) {
    return this.platform.createRequirement(dto, user.id);
  }

  @Patch('document-requirements/:id')
  updateRequirement(
    @Param('id') id: string,
    @Body() dto: UpdateRequirementDto,
  ) {
    return this.platform.updateRequirement(id, dto);
  }

  @Get('plans')
  plans() {
    return this.platform.plans();
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.platform.updatePlan(id, dto);
  }

  @Get('calendars')
  calendars() {
    return this.platform.calendars();
  }

  @Post('calendars')
  createCalendar(@Body() dto: CalendarDto) {
    return this.platform.createCalendar(dto);
  }

  @Delete('calendars/:id')
  @HttpCode(204)
  deleteCalendar(@Param('id') id: string) {
    return this.platform.deleteCalendar(id);
  }
}
