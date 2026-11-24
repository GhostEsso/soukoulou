import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, VerificationStatus } from '@prisma/client';
import { MailService } from '../mail/mail.module';
import { NotificationsService } from '../notifications/notifications.module';
import { PrismaService } from '../prisma/prisma.module';
import { BillingService } from '../schools/billing.service';
import { OnboardingService } from '../schools/onboarding.service';
import {
  CalendarDto,
  ListSchoolsQuery,
  RequirementDto,
  ReviewDocumentDto,
  UpdatePlanDto,
  UpdateRequirementDto,
} from './dto';

const schoolAdmins = {
  where: { role: 'SCHOOL_ADMIN' as const },
  select: {
    title: true,
    user: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    },
  },
};

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
    private readonly billing: BillingService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Alertes ─────────────────────────────────────────────

  async alerts(unreadOnly: boolean) {
    const where = unreadOnly ? { readAt: null } : {};
    const [items, unread] = await Promise.all([
      this.prisma.platformAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          school: {
            select: { id: true, name: true, city: true, country: true },
          },
        },
      }),
      this.prisma.platformAlert.count({ where: { readAt: null } }),
    ]);
    return { unread, items };
  }

  async readAlert(id: string) {
    await this.prisma.platformAlert.updateMany({
      where: { id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  // ── Vérifications ───────────────────────────────────────

  verifications(status: VerificationStatus = 'PENDING') {
    return this.prisma.school.findMany({
      where: { verificationStatus: status },
      orderBy: { updatedAt: 'asc' }, // les plus anciennes en premier
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        type: true,
        verificationStatus: true,
        updatedAt: true,
        plan: { select: { code: true, name: true } },
        _count: { select: { documents: true } },
      },
    });
  }

  async verification(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        plan: true,
        memberships: schoolAdmins,
        documents: {
          include: {
            requirement: {
              select: { name: true, checkpoints: true, isMandatory: true },
            },
          },
        },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!school) throw new NotFoundException();
    const requirements = await this.onboarding.requirementsFor(school);
    return {
      school,
      requirements,
      duplicates: await this.duplicatesOf(school),
    };
  }

  /** Écoles qui ressemblent à celle-ci : même téléphone, email, autorisation, ou même nom + ville. */
  private duplicatesOf(s: {
    id: string;
    name: string;
    city: string;
    phone: string | null;
    email: string | null;
    authorizationNumber: string | null;
  }) {
    const or: Prisma.SchoolWhereInput[] = [
      {
        name: { equals: s.name, mode: 'insensitive' },
        city: { equals: s.city, mode: 'insensitive' },
      },
    ];
    if (s.phone) or.push({ phone: s.phone });
    if (s.email) or.push({ email: { equals: s.email, mode: 'insensitive' } });
    if (s.authorizationNumber) {
      or.push({
        authorizationNumber: {
          equals: s.authorizationNumber,
          mode: 'insensitive',
        },
      });
    }
    return this.prisma.school.findMany({
      where: { id: { not: s.id }, OR: or },
      select: {
        id: true,
        name: true,
        city: true,
        subscriptionStatus: true,
        verificationStatus: true,
      },
      take: 10,
    });
  }

  async reviewDocument(
    schoolId: string,
    documentId: string,
    adminId: string,
    dto: ReviewDocumentDto,
  ) {
    const doc = await this.prisma.schoolDocument.findFirst({
      where: { id: documentId, schoolId },
      include: { school: true },
    });
    if (!doc) throw new NotFoundException();
    // Dossier en examen, ou nouvelle pièce d'une école déjà vérifiée.
    const reviewable =
      doc.school.verificationStatus === 'PENDING' ||
      (doc.school.verificationStatus === 'VERIFIED' &&
        doc.reviewStatus === 'PENDING');
    if (!reviewable)
      throw new ConflictException('Ce dossier n’est pas en cours d’examen.');

    const accepted = dto.status === 'ACCEPTED';
    await this.prisma.schoolDocument.update({
      where: { id: doc.id },
      data: {
        reviewStatus: dto.status,
        reviewComment: accepted ? null : dto.comment,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
    await this.prisma.schoolEvent.create({
      data: {
        schoolId,
        action: accepted ? 'DOCUMENT_ACCEPTED' : 'DOCUMENT_REJECTED',
        actorId: adminId,
        documentId: doc.id,
        message: dto.comment,
      },
    });
    // Nouvelle pièce d'une école vérifiée refusée : on prévient directement l'école.
    if (!accepted && doc.school.verificationStatus === 'VERIFIED') {
      await this.notifyAdmins(
        schoolId,
        'Pièce justificative à remplacer',
        `${dto.comment}`,
      );
    }
    return this.verification(schoolId);
  }

  async approve(schoolId: string, adminId: string) {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      include: { documents: true },
    });
    if (school.verificationStatus !== 'PENDING') {
      throw new ConflictException('Ce dossier n’est pas en cours d’examen.');
    }
    const reqs = await this.onboarding.requirementsFor(school);
    const allAccepted =
      reqs.every(
        (r) => !r.isMandatory || r.document?.reviewStatus === 'ACCEPTED',
      ) &&
      reqs.every((r) => !r.document || r.document.reviewStatus === 'ACCEPTED');
    if (!allAccepted) {
      throw new BadRequestException(
        'Toutes les pièces doivent être marquées conformes.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.school.update({
        where: { id: schoolId },
        data: {
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: adminId,
          events: { create: { action: 'VERIFIED', actorId: adminId } },
        },
      }),
      this.prisma.platformAlert.updateMany({
        where: { schoolId, readAt: null },
        data: { readAt: new Date() },
      }),
    ]);
    await this.notifyAdmins(
      schoolId,
      'Votre école est vérifiée',
      'Vous pouvez maintenant inviter vos enseignants, vos élèves et leurs parents.',
    );
    return this.verification(schoolId);
  }

  async requestChanges(schoolId: string, adminId: string, message: string) {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      include: { documents: { include: { requirement: true } } },
    });
    if (school.verificationStatus !== 'PENDING') {
      throw new ConflictException('Ce dossier n’est pas en cours d’examen.');
    }
    await this.prisma.$transaction([
      this.prisma.school.update({
        where: { id: schoolId },
        data: {
          verificationStatus: 'CHANGES_REQUESTED',
          events: {
            create: { action: 'CHANGES_REQUESTED', actorId: adminId, message },
          },
        },
      }),
      this.prisma.platformAlert.updateMany({
        where: { schoolId, readAt: null },
        data: { readAt: new Date() },
      }),
    ]);
    const rejected = school.documents
      .filter((d) => d.reviewStatus === 'REJECTED')
      .map((d) => `- ${d.requirement.name} : ${d.reviewComment}`)
      .join('\n');
    await this.notifyAdmins(
      schoolId,
      'Votre dossier doit être complété',
      `${message}${rejected ? `\n\nPièces à remplacer :\n${rejected}` : ''}`,
    );
    return this.verification(schoolId);
  }

  /** Refus définitif : réservé à la fraude. */
  async reject(schoolId: string, adminId: string, reason: string) {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
    });
    if (!['PENDING', 'CHANGES_REQUESTED'].includes(school.verificationStatus)) {
      throw new ConflictException('Ce dossier n’est pas en cours d’examen.');
    }
    await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        verificationStatus: 'REJECTED',
        subscriptionStatus: 'SUSPENDED',
        suspendedReason: reason,
        events: {
          create: { action: 'REJECTED', actorId: adminId, message: reason },
        },
      },
    });
    await this.notifyAdmins(schoolId, 'Votre dossier a été refusé', reason);
  }

  // ── Paiements et écoles ─────────────────────────────────

  pendingTransfers() {
    return this.prisma.subscriptionPayment.findMany({
      where: { method: 'TRANSFER', status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        school: { select: { id: true, name: true, city: true } },
        plan: { select: { name: true } },
      },
    });
  }

  async confirmTransfer(paymentId: string, adminId: string) {
    const p = await this.prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
    });
    if (!p || p.method !== 'TRANSFER') throw new NotFoundException();
    return this.billing.markPaid(paymentId, adminId);
  }

  schools(q: ListSchoolsQuery) {
    return this.prisma.school.findMany({
      where: {
        subscriptionStatus: q.status,
        ...(q.q && { name: { contains: q.q, mode: 'insensitive' } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        country: true,
        subscriptionStatus: true,
        verificationStatus: true,
        subscriptionEndsAt: true,
        plan: { select: { code: true, name: true } },
        createdAt: true,
      },
    });
  }

  async suspend(schoolId: string, adminId: string, reason: string) {
    await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        subscriptionStatus: 'SUSPENDED',
        suspendedReason: reason,
        events: {
          create: { action: 'SUSPENDED', actorId: adminId, message: reason },
        },
      },
    });
    await this.notifyAdmins(schoolId, 'Votre école est suspendue', reason);
  }

  async reactivate(schoolId: string, adminId: string) {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
    });
    if (school.verificationStatus === 'REJECTED') {
      throw new ConflictException('Dossier refusé pour fraude.');
    }
    if (!school.subscriptionEndsAt || school.subscriptionEndsAt < new Date()) {
      throw new ConflictException(
        'Pas d’abonnement en cours : l’école doit payer pour être réactivée.',
      );
    }
    await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        subscriptionStatus: 'ACTIVE',
        suspendedReason: null,
        events: { create: { action: 'REACTIVATED', actorId: adminId } },
      },
    });
    await this.notifyAdmins(
      schoolId,
      'Votre école est réactivée',
      'Tous vos utilisateurs ont de nouveau accès à Soukoulou.',
    );
  }

  // ── Catalogue des pièces, offres, calendriers ──────────

  requirements() {
    return this.prisma.documentRequirement.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async createRequirement(dto: RequirementDto, adminId: string) {
    const req = await this.prisma.documentRequirement.create({
      data: {
        ...dto,
        dueDate: dto.appliesToExisting ? dto.dueDate : null,
        createdById: adminId,
      },
    });
    if (req.appliesToExisting) await this.announceRequirement(req.id);
    return req;
  }

  updateRequirement(id: string, dto: UpdateRequirementDto) {
    return this.prisma.documentRequirement.update({ where: { id }, data: dto });
  }

  /** Prévient les écoles déjà vérifiées concernées par une nouvelle pièce. */
  private async announceRequirement(requirementId: string) {
    const req = await this.prisma.documentRequirement.findUniqueOrThrow({
      where: { id: requirementId },
    });
    const schools = await this.prisma.school.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        subscriptionStatus: { in: ['ACTIVE', 'READ_ONLY'] },
      },
      include: { documents: true },
    });
    for (const s of schools) {
      const reqs = await this.onboarding.requirementsFor(s);
      if (!reqs.some((r) => r.id === req.id)) continue;
      await this.notifyAdmins(
        s.id,
        `Nouvelle pièce à fournir : ${req.name}`,
        `À envoyer depuis votre tableau de bord${req.dueDate ? ` avant le ${req.dueDate.toLocaleDateString('fr-FR')}` : ''}. Passé ce délai, les nouvelles invitations et l’encaissement des frais seront bloqués.`,
      );
    }
  }

  plans() {
    return this.prisma.plan.findMany({ orderBy: { rank: 'asc' } });
  }

  updatePlan(id: string, dto: UpdatePlanDto) {
    return this.prisma.plan.update({ where: { id }, data: dto });
  }

  calendars() {
    return this.prisma.schoolCalendar.findMany({
      orderBy: [{ country: 'asc' }, { startsOn: 'desc' }],
    });
  }

  createCalendar(dto: CalendarDto) {
    if (dto.endsOn <= dto.startsOn)
      throw new BadRequestException('La fin doit suivre le début.');
    return this.prisma.schoolCalendar.create({ data: dto });
  }

  async deleteCalendar(id: string) {
    await this.prisma.schoolCalendar.delete({ where: { id } });
  }

  private async notifyAdmins(schoolId: string, subject: string, text: string) {
    const members = await this.prisma.membership.findMany({
      where: { schoolId, role: 'SCHOOL_ADMIN' },
      select: { user: { select: { email: true } } },
    });
    for (const m of members)
      this.mail.send({ to: m.user.email, subject, text });
    await this.notifications.toAdmins(schoolId, {
      kind: 'SCHOOL',
      title: subject,
      body: text,
    });
  }
}
