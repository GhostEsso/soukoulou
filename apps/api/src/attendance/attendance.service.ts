import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { OnboardingService } from '../schools/onboarding.service';
import type { RollCallDto } from './dto';
import { isoDay, parseDay, schoolWeek } from './rules';

const today = () => parseDay(new Date().toISOString().slice(0, 10))!;

/** Appel quotidien par classe. Tout est filtré par schoolId. */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
  ) {}

  private day(s: string | undefined) {
    if (!s) return today();
    const d = parseDay(s);
    if (!d) throw new BadRequestException('Date invalide.');
    if (d > today())
      throw new BadRequestException(
        'Impossible de faire l’appel d’un jour à venir.',
      );
    return d;
  }

  private async classroom(schoolId: string, classroomId: string) {
    const c = await this.prisma.classroom.findFirst({
      where: { id: classroomId, schoolId },
      select: { id: true, name: true, yearId: true },
    });
    if (!c) throw new NotFoundException('Classe introuvable.');
    return c;
  }

  /** Liste d'appel : élèves de la classe et leur statut du jour (null = appel pas encore fait). */
  async roster(schoolId: string, classroomId: string, dayStr?: string) {
    const day = this.day(dayStr);
    const c = await this.classroom(schoolId, classroomId);
    const students = await this.prisma.student.findMany({
      where: {
        schoolId,
        enrollments: { some: { classroomId: c.id, yearId: c.yearId } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        sex: true,
        matricule: true,
        attendances: { where: { day }, select: { status: true } },
      },
    });
    return {
      day: isoDay(day),
      classroom: { id: c.id, name: c.name },
      taken: students.some((s) => s.attendances.length > 0),
      students: students.map(({ attendances, ...s }) => ({
        ...s,
        status: attendances[0]?.status ?? null,
      })),
    };
  }

  /** Enregistre l'appel : remplace les statuts du jour pour les élèves de la classe. */
  async save(schoolId: string, userId: string, dto: RollCallDto) {
    const { access, denial } = await this.onboarding.can(schoolId, 'write');
    if (!access) throw new ForbiddenException(denial);
    const day = this.day(dto.day);
    const c = await this.classroom(schoolId, dto.classroomId);
    const enrolled = await this.prisma.enrollment.findMany({
      where: {
        classroomId: c.id,
        yearId: c.yearId,
        studentId: { in: dto.items.map((i) => i.studentId) },
      },
      select: { studentId: true },
    });
    if (enrolled.length !== new Set(dto.items.map((i) => i.studentId)).size) {
      throw new BadRequestException(
        'Un élève de la liste n’est pas inscrit dans cette classe.',
      );
    }
    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.attendance.upsert({
          where: { studentId_day: { studentId: i.studentId, day } },
          create: {
            studentId: i.studentId,
            classroomId: c.id,
            day,
            status: i.status,
            takenById: userId,
          },
          update: { classroomId: c.id, status: i.status, takenById: userId },
        }),
      ),
    );
    return this.roster(schoolId, c.id, isoDay(day));
  }

  /** Semaine (lundi → vendredi) contenant `dayStr` : présents, absents, retards par jour, toute l'école. */
  async week(schoolId: string, dayStr?: string) {
    const days = schoolWeek(dayStr ? this.day(dayStr) : today());
    const rows = await this.prisma.attendance.groupBy({
      by: ['day', 'status'],
      where: { day: { gte: days[0], lte: days[4] }, student: { schoolId } },
      _count: { _all: true },
    });
    return days.map((d) => {
      const of = (status: string) =>
        rows.find((r) => r.day.getTime() === d.getTime() && r.status === status)
          ?._count._all ?? 0;
      return {
        day: isoDay(d),
        present: of('PRESENT'),
        absent: of('ABSENT'),
        late: of('LATE'),
      };
    });
  }

  /** Bilan de l'année en cours pour un élève : jours d'appel par statut et derniers absences/retards. */
  async student(schoolId: string, studentId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      select: { startsOn: true, endsOn: true },
    });
    const where = {
      studentId,
      student: { schoolId },
      ...(year && { day: { gte: year.startsOn, lte: year.endsOn } }),
    };
    const [rows, recent] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.attendance.findMany({
        where: { ...where, status: { not: 'PRESENT' } },
        orderBy: { day: 'desc' },
        take: 8,
        select: { day: true, status: true },
      }),
    ]);
    const of = (st: string) =>
      rows.find((r) => r.status === st)?._count._all ?? 0;
    const total = of('PRESENT') + of('ABSENT') + of('LATE');
    return {
      present: of('PRESENT'),
      absent: of('ABSENT'),
      late: of('LATE'),
      // Un retard compte comme une présence.
      rate: total
        ? Math.round(((total - of('ABSENT')) / total) * 1000) / 10
        : null,
      recent: recent.map((r) => ({ day: isoDay(r.day), status: r.status })),
    };
  }
}
