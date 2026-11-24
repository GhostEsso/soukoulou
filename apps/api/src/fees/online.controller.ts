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

  /** Retour du parent depuis SasPay : vérifie son paiement. */
  @HttpCode(200)
  @Post('schools/:schoolId/parent/fee-payments/:paymentId/refresh')
  refresh(
    @CurrentUser() u: AuthUser,
    @Param('schoolId') s: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.online.refreshForParent(s, u.id, paymentId);
  }

  /** Webhook SasPay (transaction.*) : signature sur « horodatage.corps brut », âge ≤ 300 s. */
  @Public()
  @HttpCode(200)
  @Post('webhooks/saspay')
  saspayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Headers('x-webhook-timestamp') timestamp: string | undefined,
  ) {
    return this.online.handleSaspayWebhook(req.rawBody, signature, timestamp);
  }

  /** Développement sans SasPay : confirmation simulée. Signature HMAC du corps brut. */
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
