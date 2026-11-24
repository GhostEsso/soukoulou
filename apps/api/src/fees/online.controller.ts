import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser, Public } from '../auth/decorators';
import { PaymentWebhookDto } from '../schools/dto';
import { CheckoutDto } from './dto';
import { OnlineService } from './online.service';

@Controller()
export class OnlineController {
  constructor(private readonly online: OnlineService) {}

  /** Le parent ouvre un paiement en ligne pour un de ses enfants. */
  @Post('schools/:schoolId/parent/children/:studentId/fees/checkout')
  checkout(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('studentId') studentId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.online.checkout(s, u.id, studentId, dto.amount);
  }

  /** Appelé par le prestataire de paiement. Signature HMAC du corps brut. */
  @Public()
  @HttpCode(200)
  @Post('webhooks/fee-payments')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-soukoulou-signature') signature: string | undefined,
    @Body() dto: PaymentWebhookDto,
  ) {
    return this.online.handleWebhook(req.rawBody, signature, dto);
  }
}
