import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.module';
import { OnboardingService } from '../schools/onboarding.service';
import type { PaymentWebhookDto } from '../schools/dto';
import { FEATURES } from '../schools/rules';
import { assignReceipt, CashboxService, fmt } from './cashbox.service';

/** En production, le paiement en ligne n'ouvre qu'avec un prestataire configuré. */
export const onlinePaymentReady = () =>
  process.env.NODE_ENV !== 'production' || !!process.env.PAYMENT_PROVIDER;

/** Paiement en ligne des frais par le parent : ouverture du paiement, puis confirmation du prestataire. */
@Injectable()
export class OnlineService {
  private readonly logger = new Logger('FeesOnline');

  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
    private readonly config: ConfigService,
    private readonly cashbox: CashboxService,
  ) {}

  async checkout(
    schoolId: string,
    parentUserId: string,
    studentId: string,
    amount: number,
  ) {
    if (!onlinePaymentReady())
      throw new ServiceUnavailableException(
        "Le paiement en ligne n'est pas encore disponible.",
      );
    const parent = await this.prisma.parent.findFirst({
      where: {
        schoolId,
        userId: parentUserId,
        children: { some: { studentId } },
      },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException();
    const { access, denial } = await this.onboarding.can(
      schoolId,
      'collect',
      FEATURES.FEE_PAYMENTS,
    );
    if (!access) throw new ForbiddenException(denial);
    // Même année que la caisse et la vue du parent : l'année courante (sinon la plus récente) ;
    // jamais le repli sur une autre année, dont aucun écran ne montrerait le solde.
    const yearId = await this.cashbox.yearId(schoolId);
    const fee = yearId
      ? await this.prisma.studentFee.findFirst({
          where: { schoolId, studentId, yearId },
          select: { id: true },
        })
      : null;
    if (!fee) throw new NotFoundException('Aucun frais pour cet élève.');

    return this.prisma.$transaction(async (tx) => {
      // Même verrou que l'encaissement en caisse : le reste à payer est lu sans concurrence.
      await tx.$queryRaw`SELECT id FROM "StudentFee" WHERE id = ${fee.id} FOR UPDATE`;
      const [lines, paid] = await Promise.all([
        tx.studentFeeLine.aggregate({
          where: { studentFeeId: fee.id },
          _sum: { amount: true },
        }),
        tx.feePayment.aggregate({
          where: { studentFeeId: fee.id, status: 'PAID' },
          _sum: { amount: true },
        }),
      ]);
      const remaining = (lines._sum.amount ?? 0) - (paid._sum.amount ?? 0);
      if (amount > remaining)
        throw new BadRequestException(
          `Le montant dépasse le reste à payer (${fmt(remaining)} FCFA).`,
        );
      // Un paiement en attente ne compte pas dans le payé : deux ouverts en même temps peuvent
      // chacun être confirmés (voir handleWebhook).
      const p = await tx.feePayment.create({
        data: {
          schoolId,
          studentFeeId: fee.id,
          amount,
          method: 'MOBILE_MONEY',
          status: 'PENDING',
          parentId: parent.id,
        },
      });
      await tx.feePayment.update({
        where: { id: p.id },
        data: { providerRef: p.id },
      });
      // ponytail: pas de prestataire branché, donc pas d'URL de paiement.
      return { paymentId: p.id, providerRef: p.id, checkoutUrl: null };
    });
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    dto: PaymentWebhookDto,
  ) {
    const secret = this.config.getOrThrow<string>('PAYMENT_WEBHOOK_SECRET');
    const expected = createHmac('sha256', secret)
      .update(rawBody ?? '')
      .digest();
    const given = Buffer.from(signature ?? '', 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected))
      throw new UnauthorizedException();

    const payment = await this.prisma.feePayment.findUnique({
      where: { providerRef: dto.providerRef },
      select: { id: true, schoolId: true, studentFeeId: true },
    });
    if (!payment) throw new NotFoundException();

    if (dto.status === 'FAILED') {
      await this.prisma.feePayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
      return this.statusOf(payment.id);
    }

    await this.prisma.$transaction(async (tx) => {
      // Ordre des verrous comme recordCash : StudentFee, puis School (assignReceipt).
      await tx.$queryRaw`SELECT id FROM "StudentFee" WHERE id = ${payment.studentFeeId} FOR UPDATE`;
      const now = new Date();
      const { count } = await tx.feePayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: now },
      });
      if (count !== 1) return; // rejeu : déjà traité
      await assignReceipt(tx, payment.schoolId, payment.id, now);
      // L'argent est reçu : on ne le refuse jamais. Si deux paiements ouverts en parallèle
      // dépassent le dû, on garde les deux (remboursement hors périmètre) et on le signale.
      const [lines, paid] = await Promise.all([
        tx.studentFeeLine.aggregate({
          where: { studentFeeId: payment.studentFeeId },
          _sum: { amount: true },
        }),
        tx.feePayment.aggregate({
          where: { studentFeeId: payment.studentFeeId, status: 'PAID' },
          _sum: { amount: true },
        }),
      ]);
      if ((paid._sum.amount ?? 0) > (lines._sum.amount ?? 0))
        this.logger.warn(
          `Trop-perçu : paiement ${payment.id} (frais ${payment.studentFeeId}) dépasse le dû, à rembourser.`,
        );
    });
    return this.statusOf(payment.id);
  }

  private async statusOf(id: string) {
    const p = await this.prisma.feePayment.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    return { status: p.status };
  }
}
