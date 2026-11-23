import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser, Public } from '../auth/decorators';
import { BillingService } from './billing.service';
import {
  CheckoutDto,
  PaymentWebhookDto,
  ThemeDto,
  UpgradeInfoDto,
} from './dto';
import { OnboardingService } from './onboarding.service';

const MAX_UPLOAD = 10 * 1_048_576;

@Controller()
export class SchoolsController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly billing: BillingService,
  ) {}

  @Public()
  @Get('public/plans')
  plans() {
    return this.billing.listPlans();
  }

  @Public()
  @Get('public/schools/slug-availability')
  async slugAvailability(@Query('slug') slug = '') {
    return {
      slug,
      available: await this.onboarding.slugAvailable(slug.toLowerCase()),
    };
  }

  @Get('schools/:schoolId/onboarding')
  async overview(
    @CurrentUser() user: AuthUser,
    @Param('schoolId') schoolId: string,
  ) {
    await this.onboarding.assertSchoolAdmin(user.id, schoolId);
    return this.onboarding.overview(schoolId);
  }

  @Put('schools/:schoolId/onboarding/info')
  async saveInfo(
    @CurrentUser() user: AuthUser,
    @Param('schoolId') schoolId: string,
    @Body() dto: UpgradeInfoDto,
  ) {
    await this.onboarding.assertSchoolAdmin(user.id, schoolId);
    return this.onboarding.saveUpgradeInfo(schoolId, user.id, dto);
  }

  @Put('schools/:schoolId/onboarding/documents/:requirementId')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD, files: 1 } }),
  )
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('schoolId') schoolId: string,
    @Param('requirementId') requirementId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    await this.onboarding.assertSchoolAdmin(user.id, schoolId);
    return this.onboarding.uploadDocument(
      schoolId,
      requirementId,
      user.id,
      file,
    );
  }

  @Post('schools/:schoolId/onboarding/resubmit')
  @HttpCode(200)
  async resubmit(
    @CurrentUser() user: AuthUser,
    @Param('schoolId') schoolId: string,
  ) {
    await this.onboarding.assertSchoolAdmin(user.id, schoolId);
    return this.onboarding.resubmit(schoolId, user.id);
  }

  @Get('schools/:schoolId/documents/:documentId/file')
  async file(
    @CurrentUser() user: AuthUser,
    @Param('schoolId') schoolId: string,
    @Param('documentId') documentId: string,
  ) {
    const doc = await this.onboarding.openDocument(user, schoolId, documentId);
    return new StreamableFile(doc.stream, {
      type: doc.mimeType,
      disposition: `inline; filename="${encodeURIComponent(doc.name)}"`,
    });
  }

  @Put('schools/:schoolId/settings/theme')
  async setTheme(
    @CurrentUser() user: AuthUser,
    @Param('schoolId') schoolId: string,
    @Body() dto: ThemeDto,
  ) {
    await this.onboarding.assertSchoolAdmin(user.id, schoolId);
    return this.onboarding.setTheme(schoolId, dto.brandColor);
  }

  @Post('schools/:schoolId/subscription/checkout')
  async checkout(
    @CurrentUser() user: AuthUser,
    @Param('schoolId') schoolId: string,
    @Body() dto: CheckoutDto,
  ) {
    await this.onboarding.assertSchoolAdmin(user.id, schoolId);
    return this.billing.checkout(schoolId, dto);
  }

  /** Appelé par le prestataire de paiement. Signature HMAC du corps brut. */
  @Public()
  @HttpCode(200)
  @Post('webhooks/payments')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-soukoulou-signature') signature: string | undefined,
    @Body() dto: PaymentWebhookDto,
  ) {
    return this.billing.handleWebhook(req.rawBody, signature, dto);
  }
}
