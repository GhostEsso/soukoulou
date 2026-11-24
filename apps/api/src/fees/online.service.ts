import {
  BadGatewayException,
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
import { saspay, saspayConfigured, saspaySignatureValid } from './saspay';

/** En production, le paiement en ligne n'ouvre qu'avec SasPay configuré ; en dev, simulation sinon. */
export const onlinePaymentReady = () =>
  process.env.NODE_ENV !== 'production' || saspayConfigured();

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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
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

    const payment = await this.prisma.$transaction(async (tx) => {
      // Même verrou que l'encaissement en caisse : le reste à payer est lu sans concurrence.
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "StudentFee" WHERE id = ${fee.id} FOR UPDATE`;
      if (!locked.length)
        throw new NotFoundException('Aucun frais pour cet élève.');
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
      return tx.feePayment.create({
        data: {
          schoolId,
          studentFeeId: fee.id,
          amount,
          method: 'MOBILE_MONEY',
          status: 'PENDING',
          parentId: parent.id,
        },
      });
    });

    if (!saspayConfigured()) {
      // Développement sans clé SasPay : paiement simulé par /webhooks/fee-payments.
      await this.prisma.feePayment.update({
        where: { id: payment.id },
        data: { providerRef: payment.id },
      });
      return {
        paymentId: payment.id,
        providerRef: payment.id,
        checkoutUrl: null,
      };
    }

    const web = this.config.getOrThrow<string>('WEB_URL');
    try {
      // Checkout hébergé : le parent choisit son réseau (Moov, MTN, carte…) sur la page SasPay.
      const session = await saspay.createCheckoutSession({
        amount,
        // ponytail: adresse de repli si le parent n'a pas d'email (champ exigé par SasPay).
        customerEmail: parent.email ?? `parent-${parent.id}@soukoulou.tg`,
        customerName: `${parent.firstName} ${parent.lastName}`,
        customerPhone: parent.phone,
        returnUrl: `${web}/parent/${encodeURIComponent(schoolId)}/enfants/${encodeURIComponent(studentId)}?paiement=${payment.id}`,
        metadata: { feePaymentId: payment.id, schoolId },
      });
      await this.prisma.feePayment.update({
        where: { id: payment.id },
        data: { provider: 'saspay', providerRef: session.id },
      });
      // Le parent est redirigé vers cette URL : uniquement une page SasPay en https.
      const url = new URL(session.checkout_url);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.saspay.me'))
        throw new BadGatewayException(
          'Le paiement en ligne est momentanément indisponible.',
        );
      return {
        paymentId: payment.id,
        providerRef: session.id,
        checkoutUrl: url.toString(),
      };
    } catch (e) {
      await this.prisma.feePayment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      throw e;
    }
  }

  /**
   * Confirme un paiement SasPay en attente : session, puis GET /payments/{id}/verify/.
   * Seul SUCCESS avec le bon montant net en XOF passe le paiement à PAID.
   */
  async reconcile(paymentId: string) {
    const p = await this.prisma.feePayment.findUnique({
      where: { id: paymentId },
      select: { status: true, provider: true, providerRef: true, amount: true },
    });
    if (
      !p ||
      p.status !== 'PENDING' ||
      p.provider !== 'saspay' ||
      !p.providerRef
    )
      return;
    const session = await saspay.sessionStatus(p.providerRef);
    if (session.status === 'EXPIRED' || session.status === 'CANCELLED')
      return this.fail(paymentId);
    if (!session.transaction_id) return; // le parent n'a pas encore payé
    const tx = await saspay.verifyPayment(session.transaction_id);
    if (tx.status === 'FAILED') return this.fail(paymentId);
    if (tx.status !== 'SUCCESS') return;
    if (tx.currency !== 'XOF' || Number(tx.net_amount) !== p.amount) {
      this.logger.error(
        `Paiement ${paymentId} : montant SasPay ${tx.net_amount} ${tx.currency} ≠ ${p.amount} XOF, à vérifier à la main.`,
      );
      return;
    }
    await this.confirm(paymentId);
  }

  /** Après un webhook SasPay : revérifie les paiements en attente récents (le webhook ne porte pas notre référence). */
  async reconcilePending() {
    const pending = await this.prisma.feePayment.findMany({
      where: {
        provider: 'saspay',
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 3 * 86_400_000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // ponytail: borne sous la limite SasPay de 300 req/min
      select: { id: true },
    });
    for (const { id } of pending)
      await this.reconcile(id).catch((e: Error) =>
        this.logger.error(`Vérification ${id} : ${e.message}`),
      );
  }

  /** Retour du parent depuis la page SasPay : on vérifie son paiement tout de suite. */
  async refreshForParent(
    schoolId: string,
    parentUserId: string,
    paymentId: string,
  ) {
    const parent = await this.prisma.parent.findFirst({
      where: { schoolId, userId: parentUserId },
      select: { id: true },
    });
    const p = parent
      ? await this.prisma.feePayment.findFirst({
          where: { id: paymentId, schoolId, parentId: parent.id },
          select: { id: true },
        })
      : null;
    if (!p) throw new NotFoundException();
    await this.reconcile(p.id);
    return this.statusOf(p.id);
  }

  handleSaspayWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    timestamp: string | undefined,
  ) {
    const secret = this.config.getOrThrow<string>('SASPAY_WEBHOOK_SECRET');
    if (
      !rawBody ||
      !saspaySignatureValid(rawBody, signature, timestamp, secret)
    )
      throw new UnauthorizedException();
    // Réponse immédiate ; la vérification (verify) se fait ensuite, idempotente.
    void this.reconcilePending();
    return { received: true };
  }

  private fail(id: string) {
    return this.prisma.feePayment.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'FAILED' },
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
    // Avec SasPay, seule sa vérification confirme un paiement.
    if (saspayConfigured()) throw new NotFoundException();

    const payment = await this.prisma.feePayment.findUnique({
      where: { providerRef: dto.providerRef },
      select: { id: true },
    });
    if (!payment) throw new NotFoundException();

    if (dto.status === 'FAILED') await this.fail(payment.id);
    else await this.confirm(payment.id);
    return this.statusOf(payment.id);
  }

  /** PENDING → PAID une seule fois, avec numéro de reçu. */
  private async confirm(paymentId: string) {
    const payment = await this.prisma.feePayment.findUnique({
      where: { id: paymentId },
      select: { id: true, schoolId: true, studentFeeId: true },
    });
    if (!payment) return;
    await this.prisma.$transaction(async (tx) => {
      // Ordre des verrous comme recordCash : StudentFee, puis School (assignReceipt).
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "StudentFee" WHERE id = ${payment.studentFeeId} FOR UPDATE`;
      if (!locked.length) return; // dû supprimé entre-temps
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
  }

  private async statusOf(id: string) {
    const p = await this.prisma.feePayment.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!p) throw new NotFoundException();
    return { status: p.status };
  }
}
