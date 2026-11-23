import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import type { AuthUser } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.module';
import { UpgradeInfoDto } from './dto';
import {
  checkAccess,
  contrastWithWhite,
  FEATURES,
  isOverdue,
  isSlugAllowed,
  Need,
  requirementApplies,
  sniffMime,
} from './rules';

type SchoolWithDocs = Prisma.SchoolGetPayload<{ include: { documents: true } }>;

const NEEDS: Need[] = ['read', 'write', 'publish', 'invite', 'collect'];
const EDITABLE_DOSSIER = ['NOT_SUBMITTED', 'CHANGES_REQUESTED'];

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async assertSchoolAdmin(userId: string, schoolId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_schoolId: { userId, schoolId } },
    });
    if (m?.role !== 'SCHOOL_ADMIN') throw new ForbiddenException();
  }

  /** Tout ce dont le tableau de bord de l'école a besoin pour l'onboarding. */
  async overview(schoolId: string) {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      include: { documents: true, plan: true },
    });
    const requirements = await this.requirementsFor(school);
    const state = {
      subscriptionStatus: school.subscriptionStatus,
      verificationStatus: school.verificationStatus,
      planFeatures: school.plan?.features ?? [],
      hasOverdueDocument: requirements.some((r) => r.overdue),
    };
    const { documents, ...rest } = school;
    void documents; // les pièces sont déjà détaillées dans requirements
    return {
      school: rest,
      requirements,
      access: Object.fromEntries(NEEDS.map((n) => [n, checkAccess(state, n)])),
    };
  }

  async requirementsFor(school: SchoolWithDocs) {
    const now = new Date();
    const reqs = await this.prisma.documentRequirement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return reqs
      .filter((r) => requirementApplies(r, school))
      .map((r) => {
        const doc = school.documents.find((d) => d.requirementId === r.id);
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          isMandatory: r.isMandatory,
          acceptedMimeTypes: r.acceptedMimeTypes,
          maxSizeBytes: r.maxSizeBytes,
          dueDate: r.dueDate,
          overdue: isOverdue(r, doc, now),
          document: doc
            ? {
                id: doc.id,
                originalName: doc.originalName,
                reviewStatus: doc.reviewStatus,
                reviewComment: doc.reviewComment,
                uploadedAt: doc.uploadedAt,
              }
            : null,
        };
      });
  }

  async slugAvailable(slug: string) {
    if (!isSlugAllowed(slug)) return false;
    return !(await this.prisma.school.findUnique({ where: { slug } }));
  }

  async saveUpgradeInfo(schoolId: string, userId: string, dto: UpgradeInfoDto) {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
    });
    if (!EDITABLE_DOSSIER.includes(school.verificationStatus)) {
      throw new ConflictException(
        'Le dossier est en cours de vérification ou déjà validé.',
      );
    }
    if (school.slug && school.slug !== dto.desiredSlug) {
      throw new ConflictException('L’adresse de l’école est déjà réservée.');
    }
    if (!school.slug && !(await this.slugAvailable(dto.desiredSlug))) {
      throw new ConflictException('Cette adresse n’est pas disponible.');
    }
    await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        ...dto,
        events: { create: { action: 'UPGRADE_INFO_SAVED', actorId: userId } },
      },
    });
    return this.overview(schoolId);
  }

  async uploadDocument(
    schoolId: string,
    requirementId: string,
    userId: string,
    file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Fichier manquant.');
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      include: { documents: true },
    });
    const req = await this.prisma.documentRequirement.findUnique({
      where: { id: requirementId },
    });
    if (!req || !requirementApplies(req, school)) {
      throw new NotFoundException('Pièce non demandée à cette école.');
    }

    const existing = school.documents.find(
      (d) => d.requirementId === requirementId,
    );
    if (existing?.reviewStatus === 'ACCEPTED') {
      throw new ConflictException('Cette pièce est déjà validée.');
    }
    // Pendant l'examen, le dossier est figé. Une école vérifiée peut fournir une nouvelle pièce.
    const isNewForVerified =
      school.verificationStatus === 'VERIFIED' && !existing;
    if (
      !EDITABLE_DOSSIER.includes(school.verificationStatus) &&
      !isNewForVerified
    ) {
      throw new ConflictException('Le dossier est en cours de vérification.');
    }
    if (
      existing?.reviewStatus === 'PENDING' &&
      school.verificationStatus === 'CHANGES_REQUESTED'
    ) {
      throw new ConflictException(
        'Seules les pièces refusées peuvent être remplacées.',
      );
    }

    const mime = sniffMime(file.buffer);
    if (!mime || !req.acceptedMimeTypes.includes(mime)) {
      throw new BadRequestException(
        'Format non accepté. Envoyez un PDF, JPG ou PNG.',
      );
    }
    if (file.size > req.maxSizeBytes) {
      throw new BadRequestException(
        `Fichier trop lourd (maximum ${Math.round(req.maxSizeBytes / 1_048_576)} Mo).`,
      );
    }

    const fileKey = `${schoolId}/${randomUUID()}`;
    const path = this.filePath(fileKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.buffer);

    const data = {
      fileKey,
      originalName: file.originalname.slice(0, 200),
      mimeType: mime,
      sizeBytes: file.size,
      uploadedAt: new Date(),
      reviewStatus: 'PENDING' as const,
      reviewComment: null,
      reviewedById: null,
      reviewedAt: null,
    };
    const doc = await this.prisma.schoolDocument.upsert({
      where: { schoolId_requirementId: { schoolId, requirementId } },
      create: { schoolId, requirementId, ...data },
      update: data,
    });
    await this.prisma.schoolEvent.create({
      data: {
        schoolId,
        action: 'DOCUMENT_UPLOADED',
        actorId: userId,
        documentId: doc.id,
      },
    });
    if (isNewForVerified) {
      await this.prisma.platformAlert.create({
        data: { schoolId, type: 'DOCUMENT_UPLOADED' },
      });
    }
    if (existing)
      await unlink(this.filePath(existing.fileKey)).catch(() => undefined);
    return this.overview(schoolId);
  }

  /** L'école renvoie son dossier après avoir remplacé les pièces refusées. */
  async resubmit(schoolId: string, userId: string) {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      include: { documents: true },
    });
    if (school.verificationStatus !== 'CHANGES_REQUESTED') {
      throw new ConflictException('Aucune correction n’est demandée.');
    }
    const reqs = await this.requirementsFor(school);
    if (reqs.some((r) => r.isMandatory && !r.document)) {
      throw new BadRequestException(
        'Toutes les pièces obligatoires doivent être fournies.',
      );
    }
    if (reqs.some((r) => r.document?.reviewStatus === 'REJECTED')) {
      throw new BadRequestException('Remplacez d’abord les pièces refusées.');
    }
    await this.prisma.school.update({
      where: { id: schoolId },
      data: {
        verificationStatus: 'PENDING',
        events: { create: { action: 'RESUBMITTED', actorId: userId } },
        alerts: { create: { type: 'RESUBMITTED' } },
      },
    });
    return this.overview(schoolId);
  }

  /** Ouvre une pièce : responsable de l'école ou admin Soukoulou uniquement. */
  async openDocument(user: AuthUser, schoolId: string, documentId: string) {
    if (!user.isPlatformAdmin) await this.assertSchoolAdmin(user.id, schoolId);
    const doc = await this.prisma.schoolDocument.findFirst({
      where: { id: documentId, schoolId },
    });
    if (!doc) throw new NotFoundException();
    return {
      stream: createReadStream(this.filePath(doc.fileKey)),
      mimeType: doc.mimeType,
      name: doc.originalName,
    };
  }

  /** Couleur d'accent de l'école (offre Premium). null = bleu Soukoulou. */
  async setTheme(schoolId: string, brandColor: string | null) {
    const { access, denial } = await this.can(
      schoolId,
      'write',
      FEATURES.CUSTOM_THEME,
    );
    if (!access) throw new ForbiddenException(denial);
    if (brandColor && contrastWithWhite(brandColor) < 4.5) {
      throw new BadRequestException(
        'Couleur trop claire : le texte blanc des boutons serait illisible. Choisissez une teinte plus foncée.',
      );
    }
    await this.prisma.school.update({
      where: { id: schoolId },
      data: { brandColor: brandColor?.toUpperCase() ?? null },
    });
    return this.overview(schoolId);
  }

  /** Vérifie une action pour une école (statut, offre, vérification, pièces en retard). */
  async can(schoolId: string, need: Need, feature?: string) {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      include: { documents: true, plan: true },
    });
    const reqs = await this.requirementsFor(school);
    const denial = checkAccess(
      {
        subscriptionStatus: school.subscriptionStatus,
        verificationStatus: school.verificationStatus,
        planFeatures: school.plan?.features ?? [],
        hasOverdueDocument: reqs.some((r) => r.overdue),
      },
      need,
      feature,
    );
    return { access: denial === null, denial };
  }

  private filePath(fileKey: string) {
    // fileKey est toujours généré par le serveur, jamais fourni par l'utilisateur.
    return resolve(this.config.getOrThrow<string>('UPLOAD_DIR'), fileKey);
  }
}
