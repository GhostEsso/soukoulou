import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { MailService } from '../mail/mail.module';
import { PrismaService } from '../prisma/prisma.module';
import { CheckoutDto, PaymentWebhookDto } from './dto';
import { OnboardingService } from './onboarding.service';
import { amountFor, periodFor } from './rules';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { rank: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        priceMonthly: true,
        currency: true,
        schoolYearMonths: true,
        schoolYearFreeMonths: true,
        features: true,
      },
    });
  }

  /** Upgrade, renouvellement ou réactivation. */
  async checkout(schoolId: string, dto: CheckoutDto) {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      include: { documents: true },
    });
    if (school.verificationStatus === 'REJECTED' || school.suspendedReason) {
      throw new ForbiddenException(
        'Ce compte est bloqué. Contactez Soukoulou.',
      );
    }
    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.planCode },
    });
    if (!plan?.isActive) throw new NotFoundException('Offre inconnue.');

    if (!school.slug) {
      // Premier paiement : le dossier doit être complet.
      const missingInfo =
        !school.ownership || !school.authorizationNumber || !school.address;
      if (missingInfo || !school.desiredSlug) {
        throw new BadRequestException(
          'Complétez d’abord les informations de l’établissement.',
        );
      }
      const reqs = await this.onboarding.requirementsFor(school);
      if (
        reqs.some(
          (r) =>
            r.isMandatory &&
            (!r.document || r.document.reviewStatus === 'REJECTED'),
        )
      ) {
        throw new BadRequestException(
          'Envoyez toutes les pièces justificatives obligatoires.',
        );
      }
      if (!(await this.onboarding.slugAvailable(school.desiredSlug))) {
        throw new ConflictException(
          'L’adresse choisie vient d’être prise. Choisissez-en une autre.',
        );
      }
    }
    // ponytail: changement d'offre en cours d'abonnement (prorata) pas encore géré.
    if (
      school.planId &&
      school.planId !== plan.id &&
      school.subscriptionStatus === 'ACTIVE'
    ) {
      throw new ConflictException('Changement d’offre bientôt disponible.');
    }

    const manual = dto.method === 'TRANSFER';
    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        schoolId,
        planId: plan.id,
        billingCycle: dto.billingCycle,
        amount: amountFor(plan, dto.billingCycle),
        currency: plan.currency,
        method: dto.method,
        provider: manual ? 'manual' : 'dev',
      },
    });
    // ponytail: prestataire « dev » — la référence est l'id du paiement. Brancher l'agrégateur Mobile Money ici.
    await this.prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { providerRef: payment.id },
    });
    if (manual) {
      await this.prisma.platformAlert.create({
        data: { schoolId, type: 'PAYMENT_TO_CONFIRM' },
      });
    }
    return {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      instructions: manual
        ? `Effectuez le virement en indiquant la référence ${payment.id}. Soukoulou confirmera la réception.`
        : null,
    };
  }

  /** Paiement confirmé (webhook ou admin). Idempotent. */
  async markPaid(paymentId: string, confirmedById: string | null) {
    const payment = await this.prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: {
        plan: true,
        school: { include: { memberships: { include: { user: true } } } },
      },
    });
    if (!payment) throw new NotFoundException();
    if (payment.status !== 'PENDING') return { status: payment.status };

    const { school, plan } = payment;
    const now = new Date();
    const { start, end } = periodFor(
      payment.billingCycle,
      plan.schoolYearMonths,
      now,
      school.subscriptionEndsAt,
    );
    const firstPayment = school.verificationStatus === 'NOT_SUBMITTED';
    const invoiceNumber = `SKL-${now.getFullYear()}-${payment.id.slice(-8).toUpperCase()}`;

    const applied = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.subscriptionPayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'PAID',
          paidAt: now,
          periodStart: start,
          periodEnd: end,
          confirmedById,
          invoiceNumber,
        },
      });
      if (count !== 1) return false;
      await tx.school.update({
        where: { id: school.id },
        data: {
          subscriptionStatus: 'ACTIVE',
          planId: plan.id,
          subscriptionEndsAt: end,
          slug: school.slug ?? school.desiredSlug,
          discoveryExpiresAt: null,
          ...(firstPayment && { verificationStatus: 'PENDING' }),
          events: {
            create: { action: 'PAYMENT_RECEIVED', actorId: confirmedById },
          },
          ...(firstPayment && {
            alerts: { create: { type: 'NEW_VERIFICATION' } },
          }),
        },
      });
      return true;
    });

    if (applied) {
      for (const m of school.memberships.filter(
        (m) => m.role === 'SCHOOL_ADMIN',
      )) {
        this.mail.send({
          to: m.user.email,
          subject: `Paiement reçu · facture ${invoiceNumber}`,
          text: firstPayment
            ? `Merci ! Votre abonnement ${plan.name} est actif jusqu’au ${end.toLocaleDateString('fr-FR')}. Vous pouvez configurer votre école. Vos pièces sont en cours de vérification (48 h ouvrées).`
            : `Merci ! Votre abonnement ${plan.name} est prolongé jusqu’au ${end.toLocaleDateString('fr-FR')}.`,
        });
      }
    }
    return { status: 'PAID' as const };
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
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException();
    }
    const payment = await this.prisma.subscriptionPayment.findUnique({
      where: { providerRef: dto.providerRef },
    });
    if (!payment || payment.method === 'TRANSFER')
      throw new NotFoundException();
    if (dto.status === 'FAILED') {
      await this.prisma.subscriptionPayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
      return { status: 'FAILED' };
    }
    return this.markPaid(payment.id, null);
  }
}
