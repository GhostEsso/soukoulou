import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { OnboardingService } from '../schools/onboarding.service';
import type {
  ClassroomDto,
  LevelSubjectsDto,
  PeriodDto,
  SubjectDto,
  UpdateClassroomDto,
  UpdateSubjectDto,
  UpdateYearDto,
  YearDto,
} from './dto';
import { isYearLabel, splitYear, validateYear } from './rules';

/** Contrainte d'unicité violée → message clair au lieu d'une erreur 500. */
function unique<T>(p: Promise<T>, message: string): Promise<T> {
  return p.catch((e: unknown) => {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw e;
  });
}

/**
 * Structure de l'école : années et périodes, niveaux, matières et coefficients, classes.
 * Chaque requête est filtrée par schoolId : une école ne voit ni ne modifie jamais celle d'une autre.
 */
@Injectable()
export class StructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
  ) {}

  private async assertWrite(schoolId: string) {
    const { access, denial } = await this.onboarding.can(schoolId, 'write');
    if (!access) throw new ForbiddenException(denial);
  }

  async overview(schoolId: string) {
    const [years, levels, subjects, classrooms] = await Promise.all([
      this.prisma.academicYear.findMany({
        where: { schoolId },
        orderBy: { startsOn: 'desc' },
        include: {
          periods: { orderBy: { position: 'asc' } },
          _count: { select: { classrooms: true } },
        },
      }),
      this.prisma.level.findMany({
        where: { schoolId },
        orderBy: { position: 'asc' },
        include: {
          subjects: { include: { subject: { select: { name: true } } } },
          _count: { select: { classrooms: true } },
        },
      }),
      this.prisma.subject.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' },
        include: { _count: { select: { levels: true } } },
      }),
      this.prisma.classroom.findMany({
        where: { schoolId },
        orderBy: [{ level: { position: 'asc' } }, { name: 'asc' }],
        include: { level: { select: { name: true } } },
      }),
    ]);
    return {
      years,
      subjects,
      classrooms,
      levels: levels.map((l) => ({
        ...l,
        subjects: l.subjects
          .map((s) => ({
            subjectId: s.subjectId,
            name: s.subject.name,
            coefficient: Number(s.coefficient),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      })),
    };
  }

  // ── Années scolaires ───────────────────────────────────

  private checkYear(
    label: string,
    startsOn: Date,
    endsOn: Date,
    type: 'TRIMESTER' | 'SEMESTER',
    periods: PeriodDto[],
  ) {
    if (!isYearLabel(label)) {
      throw new BadRequestException(
        'Libellé attendu : deux années qui se suivent, ex. 2026-2027.',
      );
    }
    const error = validateYear(startsOn, endsOn, type, periods);
    if (error) throw new BadRequestException(error);
  }

  async createYear(schoolId: string, dto: YearDto) {
    await this.assertWrite(schoolId);
    const periods = dto.periods?.length
      ? dto.periods
      : splitYear(dto.startsOn, dto.endsOn, dto.periodType);
    this.checkYear(
      dto.label,
      dto.startsOn,
      dto.endsOn,
      dto.periodType,
      periods,
    );
    const first =
      (await this.prisma.academicYear.count({ where: { schoolId } })) === 0;
    await unique(
      this.prisma.academicYear.create({
        data: {
          schoolId,
          label: dto.label,
          startsOn: dto.startsOn,
          endsOn: dto.endsOn,
          periodType: dto.periodType,
          isCurrent: first,
          periods: {
            create: periods.map((p, position) => ({ ...p, position })),
          },
        },
      }),
      `L’année ${dto.label} existe déjà.`,
    );
    return this.overview(schoolId);
  }

  async updateYear(schoolId: string, yearId: string, dto: UpdateYearDto) {
    await this.assertWrite(schoolId);
    const year = await this.prisma.academicYear.findFirst({
      where: { id: yearId, schoolId },
      include: { periods: { orderBy: { position: 'asc' } } },
    });
    if (!year) throw new NotFoundException();
    const label = dto.label ?? year.label;
    const startsOn = dto.startsOn ?? year.startsOn;
    const endsOn = dto.endsOn ?? year.endsOn;
    const periods = dto.periods ?? year.periods;
    this.checkYear(label, startsOn, endsOn, year.periodType, periods);

    await this.prisma.$transaction(async (tx) => {
      if (dto.isCurrent) {
        await tx.academicYear.updateMany({
          where: { schoolId, id: { not: yearId } },
          data: { isCurrent: false },
        });
      }
      await unique(
        tx.academicYear.update({
          where: { id: yearId },
          data: {
            label,
            startsOn,
            endsOn,
            ...(dto.isCurrent && { isCurrent: true }),
          },
        }),
        `L’année ${label} existe déjà.`,
      );
      if (dto.periods) {
        // Mise à jour sur place (même nombre de périodes, vérifié par checkYear) : les notes y restent rattachées.
        for (const [position, p] of dto.periods.entries()) {
          await tx.period.upsert({
            where: { yearId_position: { yearId, position } },
            create: { ...p, position, yearId },
            update: p,
          });
        }
      }
    });
    return this.overview(schoolId);
  }

  async deleteYear(schoolId: string, yearId: string) {
    await this.assertWrite(schoolId);
    const year = await this.prisma.academicYear.findFirst({
      where: { id: yearId, schoolId },
      include: { _count: { select: { classrooms: true } } },
    });
    if (!year) throw new NotFoundException();
    // ponytail: refus tant que des classes existent ; plus tard, archiver au lieu de supprimer.
    if (year._count.classrooms > 0) {
      throw new ConflictException(
        'Supprimez d’abord les classes de cette année.',
      );
    }
    await this.prisma.academicYear.delete({ where: { id: yearId } });
    return this.overview(schoolId);
  }

  // ── Niveaux ────────────────────────────────────────────

  async createLevel(schoolId: string, name: string) {
    await this.assertWrite(schoolId);
    const last = await this.prisma.level.findFirst({
      where: { schoolId },
      orderBy: { position: 'desc' },
    });
    await unique(
      this.prisma.level.create({
        data: { schoolId, name, position: (last?.position ?? -1) + 1 },
      }),
      `Le niveau « ${name} » existe déjà.`,
    );
    return this.overview(schoolId);
  }

  async renameLevel(schoolId: string, levelId: string, name: string) {
    await this.assertWrite(schoolId);
    await this.own('level', schoolId, levelId);
    await unique(
      this.prisma.level.update({ where: { id: levelId }, data: { name } }),
      `Le niveau « ${name} » existe déjà.`,
    );
    return this.overview(schoolId);
  }

  async orderLevels(schoolId: string, ids: string[]) {
    await this.assertWrite(schoolId);
    const levels = await this.prisma.level.findMany({
      where: { schoolId },
      select: { id: true },
    });
    const known = new Set(levels.map((l) => l.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw new BadRequestException(
        'La liste doit contenir tous les niveaux de l’école.',
      );
    }
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.level.update({ where: { id }, data: { position } }),
      ),
    );
    return this.overview(schoolId);
  }

  async deleteLevel(schoolId: string, levelId: string) {
    await this.assertWrite(schoolId);
    const level = await this.prisma.level.findFirst({
      where: { id: levelId, schoolId },
      include: { _count: { select: { classrooms: true } } },
    });
    if (!level) throw new NotFoundException();
    if (level._count.classrooms > 0) {
      throw new ConflictException(
        'Ce niveau a des classes : supprimez-les ou changez leur niveau d’abord.',
      );
    }
    await this.prisma.level.delete({ where: { id: levelId } });
    return this.overview(schoolId);
  }

  /** Remplace les matières du niveau et leurs coefficients. */
  async setLevelSubjects(
    schoolId: string,
    levelId: string,
    dto: LevelSubjectsDto,
  ) {
    await this.assertWrite(schoolId);
    await this.own('level', schoolId, levelId);
    const ids = dto.items.map((i) => i.subjectId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Une matière apparaît deux fois.');
    }
    const owned = await this.prisma.subject.count({
      where: { schoolId, id: { in: ids } },
    });
    if (owned !== ids.length)
      throw new BadRequestException('Matière inconnue.');
    await this.prisma.$transaction([
      this.prisma.levelSubject.deleteMany({ where: { levelId } }),
      this.prisma.levelSubject.createMany({
        data: dto.items.map((i) => ({
          levelId,
          subjectId: i.subjectId,
          coefficient: i.coefficient,
        })),
      }),
    ]);
    return this.overview(schoolId);
  }

  // ── Matières ───────────────────────────────────────────

  async createSubject(schoolId: string, dto: SubjectDto) {
    await this.assertWrite(schoolId);
    await unique(
      this.prisma.subject.create({
        data: { schoolId, name: dto.name, shortName: dto.shortName || null },
      }),
      `La matière « ${dto.name} » existe déjà.`,
    );
    return this.overview(schoolId);
  }

  async updateSubject(
    schoolId: string,
    subjectId: string,
    dto: UpdateSubjectDto,
  ) {
    await this.assertWrite(schoolId);
    await this.own('subject', schoolId, subjectId);
    await unique(
      this.prisma.subject.update({
        where: { id: subjectId },
        data: {
          name: dto.name,
          ...(dto.shortName !== undefined && {
            shortName: dto.shortName || null,
          }),
        },
      }),
      `La matière « ${dto.name} » existe déjà.`,
    );
    return this.overview(schoolId);
  }

  async deleteSubject(schoolId: string, subjectId: string) {
    await this.assertWrite(schoolId);
    await this.own('subject', schoolId, subjectId);
    // Retire aussi la matière des niveaux et des emplois du temps ; refusé dès qu'une note existe.
    const assessments = await this.prisma.assessment.count({
      where: { subjectId },
    });
    if (assessments > 0) {
      throw new ConflictException(
        `${assessments} évaluation${assessments > 1 ? 's portent' : ' porte'} sur cette matière : supprimez-les d’abord.`,
      );
    }
    await this.prisma.subject.delete({ where: { id: subjectId } });
    return this.overview(schoolId);
  }

  // ── Classes ────────────────────────────────────────────

  async createClassroom(schoolId: string, dto: ClassroomDto) {
    await this.assertWrite(schoolId);
    await this.own('academicYear', schoolId, dto.yearId);
    await this.own('level', schoolId, dto.levelId);
    await unique(
      this.prisma.classroom.create({
        data: {
          schoolId,
          yearId: dto.yearId,
          levelId: dto.levelId,
          name: dto.name,
          capacity: dto.capacity ?? null,
        },
      }),
      `La classe « ${dto.name} » existe déjà pour cette année.`,
    );
    return this.overview(schoolId);
  }

  async updateClassroom(
    schoolId: string,
    classroomId: string,
    dto: UpdateClassroomDto,
  ) {
    await this.assertWrite(schoolId);
    await this.own('classroom', schoolId, classroomId);
    if (dto.levelId) await this.own('level', schoolId, dto.levelId);
    await unique(
      this.prisma.classroom.update({
        where: { id: classroomId },
        data: { name: dto.name, levelId: dto.levelId, capacity: dto.capacity },
      }),
      `La classe « ${dto.name} » existe déjà pour cette année.`,
    );
    return this.overview(schoolId);
  }

  async deleteClassroom(schoolId: string, classroomId: string) {
    await this.assertWrite(schoolId);
    await this.own('classroom', schoolId, classroomId);
    const students = await this.prisma.enrollment.count({
      where: { classroomId },
    });
    if (students > 0) {
      throw new ConflictException(
        `${students} élève${students > 1 ? 's sont inscrits' : ' est inscrit'} dans cette classe : changez-les de classe d’abord.`,
      );
    }
    await this.prisma.classroom.delete({ where: { id: classroomId } });
    return this.overview(schoolId);
  }

  /** L'objet existe et appartient bien à l'école ; sinon 404 (on ne révèle pas son existence). */
  private async own(
    model: 'level' | 'subject' | 'classroom' | 'academicYear',
    schoolId: string,
    id: string,
  ) {
    const where = { id, schoolId };
    const found =
      model === 'level'
        ? await this.prisma.level.findFirst({ where, select: { id: true } })
        : model === 'subject'
          ? await this.prisma.subject.findFirst({ where, select: { id: true } })
          : model === 'classroom'
            ? await this.prisma.classroom.findFirst({
                where,
                select: { id: true },
              })
            : await this.prisma.academicYear.findFirst({
                where,
                select: { id: true },
              });
    if (!found) throw new NotFoundException();
  }
}
