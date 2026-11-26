import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.module';
import { OnboardingService } from '../schools/onboarding.service';
import { parseDay, isoDay } from '../attendance/rules';
import type {
  AssessmentDto,
  AssessmentQuery,
  CouncilDto,
  GradesDto,
} from './dto';
import {
  ANNUAL,
  appreciation,
  classResults,
  decide,
  mean,
  mention,
  on20,
  rankOf,
} from './rules';

/** Évaluations et notes. Tout est filtré par schoolId. */
@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
    private readonly notifications: NotificationsService,
  ) {}

  private async assertWrite(schoolId: string) {
    const { access, denial } = await this.onboarding.can(schoolId, 'write');
    if (!access) throw new ForbiddenException(denial);
  }

  private async yearId(schoolId: string) {
    const y = await this.prisma.academicYear.findFirst({
      where: { schoolId },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      select: { id: true },
    });
    return y?.id ?? '';
  }

  /** Évaluations de l'année en cours (d'une classe si demandé), la plus récente d'abord. */
  async list(schoolId: string, q: AssessmentQuery) {
    const yearId = await this.yearId(schoolId);
    const rows = await this.prisma.assessment.findMany({
      where: {
        classroom: { schoolId, yearId },
        ...(q.classroomId && { classroomId: q.classroomId }),
      },
      orderBy: [{ day: 'desc' }, { createdAt: 'desc' }],
      include: {
        classroom: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        period: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        grades: { select: { score: true } },
      },
    });
    return rows.map(({ grades, teacher, day, ...a }) => ({
      ...a,
      day: isoDay(day),
      teacher: teacher && {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
      },
      graded: grades.length,
      average: mean(grades.map((g) => on20(Number(g.score), a.maxScore))),
    }));
  }

  /** Crée une évaluation : la période vient de la date, l'enseignant de l'affectation actuelle. */
  async create(schoolId: string, dto: AssessmentDto) {
    await this.assertWrite(schoolId);
    const day = parseDay(dto.day);
    if (!day) throw new BadRequestException('Date invalide.');
    const c = await this.prisma.classroom.findFirst({
      where: { id: dto.classroomId, schoolId },
      select: {
        id: true,
        name: true,
        yearId: true,
        level: {
          select: {
            subjects: {
              where: { subjectId: dto.subjectId },
              select: { subjectId: true },
            },
          },
        },
        teachings: {
          where: { subjectId: dto.subjectId },
          select: { teacherId: true },
        },
      },
    });
    if (!c) throw new NotFoundException('Classe introuvable.');
    if (c.level.subjects.length === 0)
      throw new BadRequestException(
        `Cette matière n’est pas enseignée en ${c.name}.`,
      );
    const period = await this.prisma.period.findFirst({
      where: { yearId: c.yearId, startsOn: { lte: day }, endsOn: { gte: day } },
      select: { id: true },
    });
    if (!period)
      throw new BadRequestException(
        'Cette date ne tombe dans aucune période de l’année scolaire.',
      );
    return this.prisma.assessment.create({
      data: {
        classroomId: c.id,
        subjectId: dto.subjectId,
        teacherId: c.teachings[0]?.teacherId ?? null,
        periodId: period.id,
        title: dto.title,
        day,
        maxScore: dto.maxScore,
      },
      select: { id: true },
    });
  }

  /** Évaluation et liste de la classe avec la note de chaque élève (null = pas encore notée). */
  async get(schoolId: string, id: string) {
    const a = await this.prisma.assessment.findFirst({
      where: { id, classroom: { schoolId } },
      include: {
        classroom: { select: { id: true, name: true, yearId: true } },
        subject: { select: { id: true, name: true } },
        period: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        grades: { select: { studentId: true, score: true } },
      },
    });
    if (!a) throw new NotFoundException();
    const students = await this.prisma.student.findMany({
      where: {
        schoolId,
        enrollments: {
          some: { classroomId: a.classroom.id, yearId: a.classroom.yearId },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, matricule: true },
    });
    const score = new Map(a.grades.map((g) => [g.studentId, Number(g.score)]));
    const { grades, teacher, day, classroom, ...rest } = a;
    return {
      ...rest,
      day: isoDay(day),
      classroom: { id: classroom.id, name: classroom.name },
      teacher: teacher && {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
      },
      average: mean(grades.map((g) => on20(Number(g.score), a.maxScore))),
      students: students.map((s) => ({ ...s, score: score.get(s.id) ?? null })),
    };
  }

  /** Enregistre les notes : une note vide efface la note existante. */
  async saveGrades(schoolId: string, id: string, dto: GradesDto) {
    await this.assertWrite(schoolId);
    const a = await this.prisma.assessment.findFirst({
      where: { id, classroom: { schoolId } },
      select: {
        id: true,
        title: true,
        maxScore: true,
        classroomId: true,
        classroom: { select: { yearId: true } },
        subject: { select: { name: true } },
      },
    });
    if (!a) throw new NotFoundException();
    if (dto.items.some((i) => i.score != null && i.score > a.maxScore))
      throw new BadRequestException(
        `Les notes ne peuvent pas dépasser ${a.maxScore}.`,
      );
    const ids = [...new Set(dto.items.map((i) => i.studentId))];
    const enrolled = await this.prisma.enrollment.count({
      where: {
        classroomId: a.classroomId,
        yearId: a.classroom.yearId,
        studentId: { in: ids },
      },
    });
    if (enrolled !== ids.length)
      throw new BadRequestException(
        'Un élève de la liste n’est pas inscrit dans cette classe.',
      );
    const before = new Map(
      (
        await this.prisma.grade.findMany({
          where: { assessmentId: a.id, studentId: { in: ids } },
          select: { studentId: true, score: true },
        })
      ).map((g) => [g.studentId, Number(g.score)]),
    );
    await this.prisma.$transaction([
      this.prisma.grade.deleteMany({
        where: {
          assessmentId: a.id,
          studentId: {
            in: dto.items
              .filter((i) => i.score == null)
              .map((i) => i.studentId),
          },
        },
      }),
      ...dto.items
        .filter(
          (i): i is { studentId: string; score: number } => i.score != null,
        )
        .map((i) =>
          this.prisma.grade.upsert({
            where: {
              assessmentId_studentId: {
                assessmentId: a.id,
                studentId: i.studentId,
              },
            },
            create: {
              assessmentId: a.id,
              studentId: i.studentId,
              score: i.score,
            },
            update: { score: i.score },
          }),
        ),
    ]);
    // Nouvelle note ou note modifiée : la famille est prévenue (pas de doublon si rien ne change).
    const changed = dto.items.filter(
      (i) => i.score != null && before.get(i.studentId) !== i.score,
    );
    const names = await this.firstNames(changed.map((i) => i.studentId));
    // ponytail: une requête par élève dans toFamily ; à regrouper si les classes dépassent ~100 élèves
    await Promise.all(
      changed.map((i) =>
        this.notifications.toFamily(schoolId, i.studentId, {
          kind: 'GRADE',
          title: `Note : ${names.get(i.studentId)} — ${i.score}/${a.maxScore}`,
          body: `${a.subject.name} · ${a.title}`,
        }),
      ),
    );
    return this.get(schoolId, a.id);
  }

  private async firstNames(ids: string[]) {
    if (!ids.length) return new Map<string, string>();
    const rows = await this.prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true },
    });
    return new Map(rows.map((r) => [r.id, r.firstName]));
  }

  async remove(schoolId: string, id: string) {
    await this.assertWrite(schoolId);
    const { count } = await this.prisma.assessment.deleteMany({
      where: { id, classroom: { schoolId } },
    });
    if (!count) throw new NotFoundException();
  }

  /** Moyenne sur 20 des notes données par l'enseignant cette année, au total et par période. */
  async performance(schoolId: string, teacherId: string) {
    const yearId = await this.yearId(schoolId);
    const [periods, rows] = await Promise.all([
      this.prisma.period.findMany({
        where: { yearId, year: { schoolId } },
        orderBy: { position: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.assessment.findMany({
        where: { teacherId, classroom: { schoolId, yearId } },
        select: {
          periodId: true,
          maxScore: true,
          grades: { select: { score: true } },
        },
      }),
    ]);
    const scores = (periodId?: string) =>
      rows
        .filter((a) => !periodId || a.periodId === periodId)
        .flatMap((a) => a.grades.map((g) => on20(Number(g.score), a.maxScore)));
    return {
      average: mean(scores()),
      grades: scores().length,
      assessments: rows.length,
      periods: periods.map((p) => ({ ...p, average: mean(scores(p.id)) })),
    };
  }

  /** Matières du niveau de la classe (avec coefficient), évaluations notées et élèves inscrits. */
  private async classData(classroomId: string, yearId: string) {
    const [c, assessments, enrolled] = await Promise.all([
      this.prisma.classroom.findUniqueOrThrow({
        where: { id: classroomId },
        select: {
          level: {
            select: {
              subjects: {
                select: {
                  coefficient: true,
                  subject: { select: { id: true, name: true } },
                },
                orderBy: { subject: { name: 'asc' } },
              },
            },
          },
          teachings: {
            select: {
              subjectId: true,
              teacher: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.assessment.findMany({
        where: { classroomId },
        orderBy: { day: 'asc' },
        select: {
          id: true,
          title: true,
          day: true,
          maxScore: true,
          periodId: true,
          subjectId: true,
          grades: { select: { studentId: true, score: true } },
        },
      }),
      this.prisma.enrollment.findMany({
        where: { classroomId, yearId },
        select: { studentId: true },
      }),
    ]);
    return {
      subjects: c.level.subjects
        .sort((a, b) => a.subject.name.localeCompare(b.subject.name, 'fr'))
        .map((s) => {
          const t = c.teachings.find(
            (x) => x.subjectId === s.subject.id,
          )?.teacher;
          return {
            ...s.subject,
            coefficient: Number(s.coefficient),
            teacher: t ? `${t.firstName} ${t.lastName}` : null,
          };
        }),
      assessments: assessments.map((a) => ({
        ...a,
        grades: a.grades.map((g) => ({ ...g, score: Number(g.score) })),
      })),
      studentIds: enrolled.map((e) => e.studentId),
    };
  }

  /**
   * Relevé de l'élève pour l'année en cours, période par période : notes et moyenne par matière,
   * moyenne générale coefficientée et rang dans la classe.
   */
  async studentReport(schoolId: string, studentId: string) {
    const yearId = await this.yearId(schoolId);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, yearId, student: { schoolId } },
      select: { classroomId: true },
    });
    if (!enrollment) return { periods: [] };
    const [periods, data] = await Promise.all([
      this.prisma.period.findMany({
        where: { yearId },
        orderBy: { position: 'asc' },
        select: { id: true, name: true },
      }),
      this.classData(enrollment.classroomId, yearId),
    ]);
    return {
      periods: periods.map((p) => {
        const inPeriod = data.assessments.filter((a) => a.periodId === p.id);
        const results = classResults(data.subjects, inPeriod, data.studentIds);
        const mine = results.get(studentId);
        const average = mine?.average ?? null;
        const all = [...results.values()]
          .map((r) => r.average)
          .filter((v): v is number => v !== null);
        return {
          ...p,
          average,
          rank: average === null ? null : rankOf(average, all),
          ranked: all.length,
          subjects: data.subjects.map((s) => ({
            id: s.id,
            name: s.name,
            coefficient: s.coefficient,
            average: mine?.subjects.get(s.id) ?? null,
            grades: inPeriod
              .filter((a) => a.subjectId === s.id)
              .map((a) => ({
                id: a.id,
                title: a.title,
                day: isoDay(a.day),
                maxScore: a.maxScore,
                score:
                  a.grades.find((g) => g.studentId === studentId)?.score ??
                  null,
              })),
          })),
        };
      }),
    };
  }

  /**
   * Bulletins d'une classe pour une période, ou bilan annuel (`periodId` = "annual") :
   * pour chaque élève, moyenne, rang et appréciation par matière, moyenne générale, rang, mention,
   * absences et avis du conseil ; plus les statistiques de la classe.
   * Bilan annuel : moyenne de matière et moyenne générale = moyenne des périodes notées, décision proposée.
   */
  async reportCards(schoolId: string, classroomId: string, periodId: string) {
    const c = await this.prisma.classroom.findFirst({
      where: { id: classroomId, schoolId },
      select: {
        id: true,
        name: true,
        yearId: true,
        year: { select: { label: true, startsOn: true, endsOn: true } },
        level: { select: { name: true } },
        school: {
          select: {
            name: true,
            country: true,
            city: true,
            address: true,
            phone: true,
            email: true,
          },
        },
      },
    });
    if (!c) throw new NotFoundException('Classe introuvable.');
    const annual = periodId === ANNUAL;
    const periods = await this.prisma.period.findMany({
      where: { yearId: c.yearId },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, startsOn: true, endsOn: true },
    });
    const period = periods.find((p) => p.id === periodId);
    if (!annual && !period) throw new NotFoundException('Période introuvable.');
    const range = period ?? {
      startsOn: c.year.startsOn,
      endsOn: c.year.endsOn,
    };
    const scope = annual ? ANNUAL : periodId;

    const data = await this.classData(c.id, c.yearId);
    const [students, absences, notes] = await Promise.all([
      this.prisma.student.findMany({
        where: { id: { in: data.studentIds } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          matricule: true,
          sex: true,
          birthDate: true,
        },
      }),
      this.prisma.attendance.groupBy({
        by: ['studentId', 'status'],
        where: {
          classroomId: c.id,
          status: { not: 'PRESENT' },
          day: { gte: range.startsOn, lte: range.endsOn },
        },
        _count: { _all: true },
      }),
      this.prisma.councilNote.findMany({
        where: { yearId: c.yearId, scope, studentId: { in: data.studentIds } },
        select: { studentId: true, comment: true, decision: true },
      }),
    ]);

    // Résultats de chaque période (une seule hors bilan annuel).
    const byPeriod = (annual ? periods : [period!]).map((p) =>
      classResults(
        data.subjects,
        data.assessments.filter((a) => a.periodId === p.id),
        data.studentIds,
      ),
    );
    const own = (r: (typeof byPeriod)[number], id: string) => r.get(id)!;
    const subjectAvg = (id: string, subjectId: string) =>
      mean(
        byPeriod
          .map((r) => own(r, id).subjects.get(subjectId) ?? null)
          .filter((v): v is number => v !== null),
      );
    const generalAvg = (id: string) =>
      mean(
        byPeriod
          .map((r) => own(r, id).average)
          .filter((v): v is number => v !== null),
      );

    const averages = data.studentIds
      .map(generalAvg)
      .filter((v): v is number => v !== null);
    const subjectAverages = new Map(
      data.subjects.map((s) => [
        s.id,
        data.studentIds
          .map((id) => subjectAvg(id, s.id))
          .filter((v): v is number => v !== null),
      ]),
    );
    const count = (studentId: string, status: string) =>
      absences.find((a) => a.studentId === studentId && a.status === status)
        ?._count._all ?? 0;

    return {
      school: c.school,
      year: c.year.label,
      classroom: { id: c.id, name: c.name, level: c.level.name },
      period: annual
        ? { id: ANNUAL, name: 'Bilan annuel' }
        : { id: period!.id, name: period!.name },
      annual,
      periods: annual ? periods.map((p) => ({ id: p.id, name: p.name })) : [],
      stats: {
        size: students.length,
        ranked: averages.length,
        average: mean(averages),
        max: averages.length ? Math.max(...averages) : null,
        min: averages.length ? Math.min(...averages) : null,
      },
      totalCoefficient: data.subjects.reduce((n, s) => n + s.coefficient, 0),
      students: students.map((st) => {
        const average = generalAvg(st.id);
        const note = notes.find((n) => n.studentId === st.id);
        return {
          ...st,
          birthDate: st.birthDate && isoDay(st.birthDate),
          average,
          rank: average === null ? null : rankOf(average, averages),
          mention: mention(average),
          absences: count(st.id, 'ABSENT'),
          lates: count(st.id, 'LATE'),
          periodAverages: annual
            ? byPeriod.map((r) => own(r, st.id).average)
            : [],
          suggestion: annual ? decide(average) : null,
          council: {
            comment: note?.comment ?? null,
            decision: note?.decision ?? null,
          },
          subjects: data.subjects.map((s) => {
            const avg = subjectAvg(st.id, s.id);
            return {
              id: s.id,
              name: s.name,
              coefficient: s.coefficient,
              teacher: s.teacher,
              average: avg,
              points:
                avg === null
                  ? null
                  : Math.round(avg * s.coefficient * 100) / 100,
              rank:
                avg === null ? null : rankOf(avg, subjectAverages.get(s.id)!),
              appreciation: appreciation(avg),
              periodAverages: annual
                ? byPeriod.map((r) => own(r, st.id).subjects.get(s.id) ?? null)
                : [],
            };
          }),
        };
      }),
    };
  }

  /**
   * Avis du conseil de classe pour une période ou l'année (scope "annual") : remplace l'appréciation
   * (et la décision, en fin d'année) de chaque élève listé. Avis vide = supprimé.
   */
  async saveCouncil(schoolId: string, dto: CouncilDto) {
    await this.assertWrite(schoolId);
    const c = await this.prisma.classroom.findFirst({
      where: { id: dto.classroomId, schoolId },
      select: { id: true, yearId: true },
    });
    if (!c) throw new NotFoundException('Classe introuvable.');
    const annual = dto.scope === ANNUAL;
    const period = annual
      ? null
      : await this.prisma.period.findFirst({
          where: { id: dto.scope, yearId: c.yearId },
          select: { name: true },
        });
    if (!annual && !period) throw new NotFoundException('Période introuvable.');
    if (!annual && dto.items.some((i) => i.decision))
      throw new BadRequestException(
        'La décision de passage se prend sur le bilan annuel.',
      );
    const ids = [...new Set(dto.items.map((i) => i.studentId))];
    const enrolled = await this.prisma.enrollment.count({
      where: { classroomId: c.id, yearId: c.yearId, studentId: { in: ids } },
    });
    if (enrolled !== ids.length)
      throw new BadRequestException(
        'Un élève de la liste n’est pas inscrit dans cette classe.',
      );
    const scope = annual ? ANNUAL : dto.scope;
    const had = new Set(
      (
        await this.prisma.councilNote.findMany({
          where: { yearId: c.yearId, scope, studentId: { in: ids } },
          select: { studentId: true },
        })
      ).map((n) => n.studentId),
    );
    await this.prisma.$transaction(
      dto.items.map((i) => {
        const key = { studentId: i.studentId, yearId: c.yearId, scope };
        const data = {
          comment: i.comment || null,
          decision: i.decision ?? null,
        };
        return !data.comment && !data.decision
          ? this.prisma.councilNote.deleteMany({ where: key })
          : this.prisma.councilNote.upsert({
              where: { studentId_yearId_scope: key },
              create: { ...key, ...data },
              update: data,
            });
      }),
    );
    // Premier avis du conseil pour l'élève sur cette période : son bulletin est complet.
    const fresh = dto.items
      .filter((i) => (i.comment || i.decision) && !had.has(i.studentId))
      .map((i) => i.studentId);
    const names = await this.firstNames(fresh);
    const label = period ? period.name : 'bilan annuel';
    await Promise.all(
      fresh.map((id) =>
        this.notifications.toFamily(schoolId, id, {
          kind: 'REPORT_CARD',
          title: `Bulletin : ${names.get(id)} (${label})`,
          body: annual
            ? 'Le bilan annuel et la décision du conseil de classe sont disponibles.'
            : 'L’avis du conseil de classe est disponible.',
        }),
      ),
    );
  }
}
