import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { grantAccess, removeAccess, resetAccess } from '../auth/accounts';
import { photoVersion, StorageService } from '../storage/storage.module';
import { PrismaService } from '../prisma/prisma.module';
import { OnboardingService } from '../schools/onboarding.service';
import type { AssignmentsDto, TeacherDto, TeacherQuery } from './dto';

export const PAGE_SIZE = 20;

const TEACHING = {
  select: {
    id: true,
    classroom: {
      select: {
        id: true,
        name: true,
        yearId: true,
        level: { select: { position: true } },
      },
    },
    subject: { select: { id: true, name: true } },
  },
} as const;

/** Enseignants et leurs affectations (matière × classe). Tout est filtré par schoolId. */
@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
    private readonly storage: StorageService,
  ) {}

  private async assertWrite(schoolId: string) {
    const { access, denial } = await this.onboarding.can(schoolId, 'write');
    if (!access) throw new ForbiddenException(denial);
  }

  private async currentYearId(schoolId: string) {
    const y = await this.prisma.academicYear.findFirst({
      where: { schoolId },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      select: { id: true },
    });
    return y?.id ?? '';
  }

  async list(schoolId: string, q: TeacherQuery) {
    const page = q.page ?? 1;
    const yearId = await this.currentYearId(schoolId);
    const words = (q.q ?? '').split(' ').filter(Boolean);
    const where: Prisma.TeacherWhereInput = {
      schoolId,
      ...((q.subjectId || q.classroomId) && {
        teachings: {
          some: {
            ...(q.subjectId && { subjectId: q.subjectId }),
            ...(q.classroomId && { classroomId: q.classroomId }),
          },
        },
      }),
      AND: words.map((w) => ({
        OR: (
          ['firstName', 'lastName', 'matricule', 'email', 'phone'] as const
        ).map((f) => ({
          [f]: { contains: w, mode: 'insensitive' as const },
        })),
      })),
    };
    const [total, items] = await Promise.all([
      this.prisma.teacher.count({ where }),
      this.prisma.teacher.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          teachings: { where: { classroom: { yearId } }, ...TEACHING },
        },
      }),
    ]);
    return { total, page, pageSize: PAGE_SIZE, items: items.map(summarize) };
  }

  async get(schoolId: string, id: string) {
    const yearId = await this.currentYearId(schoolId);
    const t = await this.prisma.teacher.findFirst({
      where: { id, schoolId },
      include: {
        teachings: { where: { classroom: { yearId } }, ...TEACHING },
        user: { select: { loginPhone: true, mustChangePassword: true } },
      },
    });
    if (!t) throw new NotFoundException();
    const { user, ...rest } = t;
    return {
      ...summarize(rest),
      account: user && {
        phone: user.loginPhone,
        pending: user.mustChangePassword,
      },
      teachings: t.teachings
        .sort(
          (a, b) =>
            a.classroom.level.position - b.classroom.level.position ||
            a.classroom.name.localeCompare(b.classroom.name, 'fr') ||
            a.subject.name.localeCompare(b.subject.name, 'fr'),
        )
        .map((a) => ({
          id: a.id,
          classroom: { id: a.classroom.id, name: a.classroom.name },
          subject: a.subject,
        })),
    };
  }

  /** Toutes les affectations de l'année en cours : qui enseigne quoi, où. */
  async assignments(schoolId: string) {
    const yearId = await this.currentYearId(schoolId);
    const rows = await this.prisma.teachingAssignment.findMany({
      where: { classroom: { schoolId, yearId } },
      select: {
        classroomId: true,
        subjectId: true,
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return rows.map((r) => ({
      classroomId: r.classroomId,
      subjectId: r.subjectId,
      teacherId: r.teacher.id,
      teacherName: `${r.teacher.firstName} ${r.teacher.lastName}`,
    }));
  }

  async count(schoolId: string) {
    return { total: await this.prisma.teacher.count({ where: { schoolId } }) };
  }

  async create(schoolId: string, dto: TeacherDto) {
    await this.assertWrite(schoolId);
    try {
      return await this.prisma.teacher.create({
        data: { schoolId, ...normalize(dto) },
      });
    } catch (e) {
      throw unique(e);
    }
  }

  async update(schoolId: string, id: string, dto: TeacherDto) {
    await this.assertWrite(schoolId);
    await this.own(schoolId, id);
    try {
      await this.prisma.teacher.update({
        where: { id },
        data: normalize(dto, true),
      });
    } catch (e) {
      throw unique(e);
    }
  }

  async remove(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    await this.own(schoolId, id);
    // ponytail: ses affectations partent avec lui ; archiver plutôt quand il saisira des notes.
    await this.prisma.$transaction(async (tx) => {
      const t = await tx.teacher.delete({ where: { id } });
      if (t.userId) await removeAccess(tx, t.userId, schoolId);
      if (t.photoKey) await this.storage.remove(t.photoKey);
    });
  }

  /** Photo de profil : JPEG, PNG ou WebP (vérifié sur les octets), remplace la précédente. */
  async setPhoto(
    schoolId: string,
    id: string,
    file: Express.Multer.File | undefined,
  ) {
    await this.assertWrite(schoolId);
    const t = await this.prisma.teacher.findFirst({
      where: { id, schoolId },
      select: { photoKey: true },
    });
    if (!t) throw new NotFoundException();
    const photoKey = await this.storage.putImage(
      `${schoolId}/teachers/${id}`,
      file,
    );
    await this.prisma.teacher.update({ where: { id }, data: { photoKey } });
    if (t.photoKey) await this.storage.remove(t.photoKey);
    return { photo: photoVersion(photoKey) };
  }

  async removePhoto(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const t = await this.prisma.teacher.findFirst({
      where: { id, schoolId },
      select: { photoKey: true },
    });
    if (!t) throw new NotFoundException();
    if (!t.photoKey) return;
    await this.prisma.teacher.update({
      where: { id },
      data: { photoKey: null },
    });
    await this.storage.remove(t.photoKey);
  }

  /** Lecture : l'administration de l'école, ou l'enseignant lui-même. */
  async openPhoto(schoolId: string, id: string, userId: string) {
    const t = await this.prisma.teacher.findFirst({
      where: { id, schoolId },
      select: { photoKey: true, userId: true },
    });
    if (!t?.photoKey) throw new NotFoundException();
    if (t.userId !== userId)
      await this.onboarding.assertSchoolAdmin(userId, schoolId);
    return this.storage.get(t.photoKey);
  }

  /**
   * Matières que l'enseignant assure dans une classe (remplace ses matières dans cette classe).
   * Chaque matière doit être enseignée au niveau de la classe et ne pas être déjà confiée à un collègue.
   */
  async setAssignments(
    schoolId: string,
    id: string,
    classroomId: string,
    dto: AssignmentsDto,
  ) {
    await this.assertWrite(schoolId);
    await this.own(schoolId, id);
    const c = await this.prisma.classroom.findFirst({
      where: { id: classroomId, schoolId },
      select: {
        id: true,
        name: true,
        level: { select: { subjects: { select: { subjectId: true } } } },
      },
    });
    if (!c) throw new NotFoundException('Classe introuvable.');
    const taught = new Set(c.level.subjects.map((s) => s.subjectId));
    if (dto.subjectIds.some((s) => !taught.has(s))) {
      throw new BadRequestException(
        `Une des matières n’est pas enseignée en ${c.name}.`,
      );
    }
    const taken = await this.prisma.teachingAssignment.findFirst({
      where: {
        classroomId,
        subjectId: { in: dto.subjectIds },
        teacherId: { not: id },
      },
      select: {
        subject: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    });
    if (taken) {
      throw new ConflictException(
        `${taken.subject.name} en ${c.name} est déjà confiée à ${taken.teacher.firstName} ${taken.teacher.lastName}.`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.teachingAssignment.deleteMany({
        where: {
          teacherId: id,
          classroomId,
          subjectId: { notIn: dto.subjectIds },
        },
      }),
      this.prisma.teachingAssignment.createMany({
        data: dto.subjectIds.map((subjectId) => ({
          teacherId: id,
          classroomId,
          subjectId,
        })),
        skipDuplicates: true,
      }),
    ]);
    return this.get(schoolId, id);
  }

  /** Accès de l'enseignant à son espace (voir auth/accounts). */
  async createAccess(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const t = await this.prisma.teacher.findFirst({
      where: { id, schoolId },
      select: { userId: true, phone: true, firstName: true, lastName: true },
    });
    if (!t) throw new NotFoundException();
    if (t.userId)
      throw new ConflictException('Cet enseignant a déjà un accès.');
    return this.prisma.$transaction(async (tx) => {
      const r = await grantAccess(tx, { schoolId, role: 'TEACHER', ...t });
      await tx.teacher.update({ where: { id }, data: { userId: r.userId } });
      return { phone: r.login, code: r.code };
    });
  }

  async resetAccess(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const userId = await this.accountOf(schoolId, id);
    return this.prisma.$transaction((tx) => resetAccess(tx, userId, schoolId));
  }

  async removeAccess(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const userId = await this.accountOf(schoolId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.teacher.update({ where: { id }, data: { userId: null } });
      await removeAccess(tx, userId, schoolId);
    });
  }

  private async accountOf(schoolId: string, id: string) {
    const t = await this.prisma.teacher.findFirst({
      where: { id, schoolId },
      select: { userId: true },
    });
    if (!t) throw new NotFoundException();
    if (!t.userId)
      throw new ConflictException('Cet enseignant n’a pas encore d’accès.');
    return t.userId;
  }

  private async own(schoolId: string, id: string) {
    const t = await this.prisma.teacher.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!t) throw new NotFoundException();
  }
}

type WithTeachings = Prisma.TeacherGetPayload<{
  include: { teachings: typeof TEACHING };
}>;

/** Fiche + matières et classes distinctes de l'année en cours. */
function summarize({ teachings, photoKey, ...t }: WithTeachings) {
  const sorted = [...teachings].sort(
    (a, b) =>
      a.classroom.level.position - b.classroom.level.position ||
      a.classroom.name.localeCompare(b.classroom.name, 'fr'),
  );
  return {
    ...t,
    photo: photoVersion(photoKey),
    subjects: [
      ...new Map(sorted.map((a) => [a.subject.id, a.subject])).values(),
    ],
    classes: [
      ...new Map(
        sorted.map((a) => [
          a.classroom.id,
          { id: a.classroom.id, name: a.classroom.name },
        ]),
      ).values(),
    ],
  };
}

function normalize(dto: TeacherDto, update = false) {
  // En modification, un champ facultatif vidé est effacé (null) ; en création il est simplement absent.
  const opt = (v: string | undefined) => v ?? (update ? null : undefined);
  return {
    firstName: dto.firstName,
    lastName: dto.lastName.toUpperCase(),
    sex: dto.sex ?? (update ? null : undefined),
    email: opt(dto.email?.toLowerCase()),
    phone: opt(dto.phone),
    address: opt(dto.address),
    matricule: opt(dto.matricule),
  };
}

function unique(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const field = String((e.meta?.target as string[] | undefined)?.join(','));
    return new ConflictException(
      field.includes('email')
        ? 'Cette adresse email est déjà utilisée par un autre enseignant.'
        : 'Ce matricule est déjà attribué.',
    );
  }
  return e;
}
