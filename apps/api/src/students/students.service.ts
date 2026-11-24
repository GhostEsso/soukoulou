import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FeesService } from '../fees/fees.service';
import { PrismaService } from '../prisma/prisma.module';
import { OnboardingService } from '../schools/onboarding.service';
import {
  assertLoginCode,
  grantAccess,
  removeAccess,
  resetAccess,
} from '../auth/accounts';
import { photoVersion, StorageService } from '../storage/storage.module';
import type { StudentDto, StudentQuery, UpdateStudentDto } from './dto';

export const PAGE_SIZE = 20;

const DUPLICATE = 'Ce matricule est déjà attribué à un autre élève.';

/** Élèves d'une école, rattachés chaque année à une classe. Tout est filtré par schoolId. */
@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
    private readonly storage: StorageService,
    private readonly fees: FeesService,
  ) {}

  private async assertWrite(schoolId: string) {
    const { access, denial } = await this.onboarding.can(schoolId, 'write');
    if (!access) throw new ForbiddenException(denial);
  }

  /** Année demandée, sinon l'année en cours (ou la plus récente). */
  private async yearOf(schoolId: string, yearId?: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId, ...(yearId && { id: yearId }) },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
    });
    if (yearId && !year) throw new NotFoundException();
    return year;
  }

  async list(schoolId: string, q: StudentQuery) {
    const year = await this.yearOf(schoolId, q.yearId);
    const page = q.page ?? 1;
    const words = (q.q ?? '').split(' ').filter(Boolean);
    const where: Prisma.StudentWhereInput = {
      schoolId,
      ...(q.sex && { sex: q.sex }),
      ...(q.classroomId && {
        enrollments: { some: { classroomId: q.classroomId, yearId: year?.id } },
      }),
      // Chaque mot doit se trouver dans le prénom, le nom ou le matricule.
      AND: words.map((w) => ({
        OR: [
          { firstName: { contains: w, mode: 'insensitive' as const } },
          { lastName: { contains: w, mode: 'insensitive' as const } },
          { matricule: { contains: w, mode: 'insensitive' as const } },
        ],
      })),
    };
    const [total, items] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          enrollments: {
            where: { yearId: year?.id ?? '' },
            include: { classroom: { select: { id: true, name: true } } },
          },
        },
      }),
    ]);
    return {
      total,
      page,
      pageSize: PAGE_SIZE,
      yearId: year?.id ?? null,
      items: items.map(({ enrollments, photoKey, ...s }) => ({
        ...s,
        photo: photoVersion(photoKey),
        classroom: enrollments[0]?.classroom ?? null,
      })),
    };
  }

  /** Fiche élève et sa classe de l'année en cours (null si non inscrit). */
  async get(schoolId: string, id: string) {
    const year = await this.yearOf(schoolId);
    const s = await this.prisma.student.findFirst({
      where: { id, schoolId },
      include: {
        user: { select: { loginCode: true, mustChangePassword: true } },
        enrollments: {
          where: { yearId: year?.id ?? '' },
          include: {
            classroom: {
              select: {
                id: true,
                name: true,
                level: { select: { name: true } },
              },
            },
          },
        },
        parents: {
          select: {
            relation: true,
            parent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });
    if (!s) throw new NotFoundException();
    const { enrollments, parents, user, photoKey, ...rest } = s;
    return {
      ...rest,
      photo: photoVersion(photoKey),
      account: user && {
        phone: rest.matricule,
        pending: user.mustChangePassword,
      },
      classroom: enrollments[0]?.classroom ?? null,
      parents: parents.map((p) => ({ ...p.parent, relation: p.relation })),
    };
  }

  /** Effectifs de l'année : total, garçons, filles, et par classe. */
  async stats(schoolId: string, yearId?: string) {
    const year = await this.yearOf(schoolId, yearId);
    if (!year)
      return { yearId: null, total: 0, male: 0, female: 0, byClassroom: [] };
    const rows = await this.prisma.enrollment.findMany({
      where: { yearId: year.id, student: { schoolId } },
      select: { classroomId: true, student: { select: { sex: true } } },
    });
    const byClassroom = new Map<
      string,
      { classroomId: string; male: number; female: number }
    >();
    let male = 0;
    for (const r of rows) {
      const c = byClassroom.get(r.classroomId) ?? {
        classroomId: r.classroomId,
        male: 0,
        female: 0,
      };
      if (r.student.sex === 'MALE') {
        c.male++;
        male++;
      } else c.female++;
      byClassroom.set(r.classroomId, c);
    }
    return {
      yearId: year.id,
      total: rows.length,
      male,
      female: rows.length - male,
      byClassroom: [...byClassroom.values()],
    };
  }

  /** La classe appartient à l'école et a encore de la place. */
  private async classroomFor(
    schoolId: string,
    classroomId: string,
    studentId?: string,
  ) {
    const c = await this.prisma.classroom.findFirst({
      where: { id: classroomId, schoolId },
      include: {
        _count: {
          select: {
            enrollments: studentId
              ? { where: { studentId: { not: studentId } } }
              : true,
          },
        },
      },
    });
    if (!c) throw new NotFoundException('Classe introuvable.');
    if (c.capacity !== null && c._count.enrollments >= c.capacity) {
      throw new ConflictException(
        `La classe ${c.name} est complète (${c.capacity} places).`,
      );
    }
    return c;
  }

  async create(schoolId: string, dto: StudentDto) {
    await this.assertWrite(schoolId);
    const c = await this.classroomFor(schoolId, dto.classroomId);
    try {
      const student = await this.prisma.student.create({
        data: {
          schoolId,
          firstName: dto.firstName,
          lastName: dto.lastName.toUpperCase(),
          sex: dto.sex,
          birthDate: dto.birthDate ?? null,
          matricule: dto.matricule || null,
          enrollments: { create: { yearId: c.yearId, classroomId: c.id } },
        },
      });
      // Fige son dû d'après la grille en vigueur (ne touche jamais un dû existant).
      await this.fees.applySchedules(schoolId, c.yearId);
      return student;
    } catch (e) {
      throw unique(e);
    }
  }

  async update(schoolId: string, id: string, dto: UpdateStudentDto) {
    await this.assertWrite(schoolId);
    const student = await this.prisma.student.findFirst({
      where: { id, schoolId },
    });
    if (!student) throw new NotFoundException();
    const c = dto.classroomId
      ? await this.classroomFor(schoolId, dto.classroomId, id)
      : null;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.student.update({
          where: { id },
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName?.toUpperCase(),
            sex: dto.sex,
            ...(dto.birthDate !== undefined && { birthDate: dto.birthDate }),
            ...(dto.matricule !== undefined && {
              matricule: dto.matricule || null,
            }),
          },
        });
        // Son identifiant de connexion suit le matricule.
        if (student.userId && dto.matricule !== undefined) {
          if (!dto.matricule)
            throw new BadRequestException(
              'Cet élève se connecte avec son matricule : retirez d’abord son accès.',
            );
          assertLoginCode(dto.matricule);
          await tx.user.update({
            where: { id: student.userId },
            data: { loginCode: dto.matricule.toLowerCase() },
          });
        }
        if (c) {
          await tx.enrollment.upsert({
            where: { studentId_yearId: { studentId: id, yearId: c.yearId } },
            create: { studentId: id, yearId: c.yearId, classroomId: c.id },
            update: { classroomId: c.id },
          });
        }
      });
      // Changement de classe : ne recalcule rien ; crée seulement un dû manquant.
      if (c) await this.fees.applySchedules(schoolId, c.yearId);
    } catch (e) {
      throw unique(e);
    }
  }

  async remove(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const { userId, photoKey } = await this.own(schoolId, id);
    // ponytail: suppression définitive ; à remplacer par un archivage quand notes et paiements existeront.
    await this.prisma.$transaction(async (tx) => {
      await tx.student.delete({ where: { id } });
      if (userId) await removeAccess(tx, userId, schoolId);
    });
    if (photoKey) await this.storage.remove(photoKey);
  }

  /** Accès de l'élève à son espace (voir auth/accounts) : identifiant = son matricule. */
  async createAccess(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const st = await this.own(schoolId, id);
    if (st.userId) throw new ConflictException('Cet élève a déjà un accès.');
    return this.prisma.$transaction(async (tx) => {
      const r = await grantAccess(tx, {
        schoolId,
        role: 'STUDENT',
        phone: null,
        ...st,
      });
      await tx.student.update({ where: { id }, data: { userId: r.userId } });
      return { phone: r.login, code: r.code };
    });
  }

  async resetAccess(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const { userId, matricule } = await this.own(schoolId, id);
    if (!userId)
      throw new ConflictException('Cet élève n’a pas encore d’accès.');
    const r = await this.prisma.$transaction((tx) =>
      resetAccess(tx, userId, schoolId),
    );
    return { phone: matricule, code: r.code };
  }

  async removeAccess(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const { userId } = await this.own(schoolId, id);
    if (!userId)
      throw new ConflictException('Cet élève n’a pas encore d’accès.');
    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({ where: { id }, data: { userId: null } });
      await removeAccess(tx, userId, schoolId);
    });
  }

  async setPhoto(
    schoolId: string,
    id: string,
    file: Express.Multer.File | undefined,
  ) {
    await this.assertWrite(schoolId);
    const { photoKey: old } = await this.own(schoolId, id);
    const photoKey = await this.storage.putImage(
      `${schoolId}/students/${id}`,
      file,
    );
    await this.prisma.student.update({ where: { id }, data: { photoKey } });
    if (old) await this.storage.remove(old);
    return { photo: photoVersion(photoKey) };
  }

  async removePhoto(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const { photoKey } = await this.own(schoolId, id);
    if (!photoKey) return;
    await this.prisma.student.update({
      where: { id },
      data: { photoKey: null },
    });
    await this.storage.remove(photoKey);
  }

  /** Lecture : l'élève lui-même, l'un de ses parents, ou l'administration de l'école. */
  async openPhoto(schoolId: string, id: string, userId: string) {
    const st = await this.prisma.student.findFirst({
      where: { id, schoolId },
      select: {
        photoKey: true,
        userId: true,
        parents: { where: { parent: { userId } }, select: { parentId: true } },
      },
    });
    if (!st?.photoKey) throw new NotFoundException();
    if (st.userId !== userId && st.parents.length === 0)
      await this.onboarding.assertSchoolAdmin(userId, schoolId);
    return this.storage.get(st.photoKey);
  }

  private async own(schoolId: string, id: string) {
    const st = await this.prisma.student.findFirst({
      where: { id, schoolId },
      select: {
        userId: true,
        matricule: true,
        firstName: true,
        lastName: true,
        photoKey: true,
      },
    });
    if (!st) throw new NotFoundException();
    return st;
  }
}

function unique(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
    ? new ConflictException(DUPLICATE)
    : e;
}
