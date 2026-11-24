import { Controller, ForbiddenException, Get, Param } from '@nestjs/common';
import { AttendanceService } from '../attendance/attendance.service';
import type { AuthUser } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { disciplineOf } from '../discipline/discipline.controller';
import { isoDay } from '../attendance/rules';
import { GradesService } from '../grades/grades.service';
import { PrismaService } from '../prisma/prisma.module';
import { photoVersion } from '../storage/storage.module';
import { ScheduleService } from '../schedule/schedule.service';

/** Espace élève : ses propres notes, présences et emploi du temps (lecture seule). */
@Controller('schools/:schoolId/student')
export class StudentSpaceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grades: GradesService,
    private readonly attendance: AttendanceService,
    private readonly schedule: ScheduleService,
  ) {}

  /** Fiche liée au compte et sa classe de l'année en cours, sinon 403. */
  private async me(u: AuthUser, s: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId: s },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      select: { id: true },
    });
    const st = await this.prisma.student.findFirst({
      where: { schoolId: s, userId: u.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        sex: true,
        matricule: true,
        photoKey: true,
        school: { select: { name: true, logoKey: true } },
        enrollments: {
          where: { yearId: year?.id ?? '' },
          select: { classroom: { select: { id: true, name: true } } },
        },
      },
    });
    if (!st)
      throw new ForbiddenException(
        'Ce compte n’est pas celui d’un élève de cette école.',
      );
    const { enrollments, school, photoKey, ...child } = st;
    return {
      school: { name: school.name, logo: photoVersion(school.logoKey) },
      child: {
        ...child,
        photo: photoVersion(photoKey),
        classroom: enrollments[0]?.classroom ?? null,
      },
    };
  }

  @Get()
  async home(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    const { school, child } = await this.me(u, s);
    const classroom = child.classroom;
    const [report, attendance, slots, discipline] = await Promise.all([
      this.grades.studentReport(s, child.id),
      this.attendance.student(s, child.id),
      classroom ? this.schedule.list(s, { classroomId: classroom.id }) : [],
      disciplineOf(this.prisma, s, child.id),
    ]);
    return { school, child, report, attendance, slots, discipline };
  }

  /** Évaluations de sa classe : à venir (aujourd'hui compris), puis les 10 dernières avec sa note. */
  @Get('exams')
  async exams(@CurrentUser() u: AuthUser, @Param('schoolId') s: string) {
    const { child } = await this.me(u, s);
    if (!child.classroom) return { upcoming: [], past: [] };
    const today = new Date(`${isoDay(new Date())}T00:00:00Z`);
    const select = {
      id: true,
      title: true,
      day: true,
      maxScore: true,
      subject: { select: { name: true } },
      period: { select: { name: true } },
      grades: { where: { studentId: child.id }, select: { score: true } },
    } as const;
    const where = { classroomId: child.classroom.id };
    const [upcoming, past] = await Promise.all([
      this.prisma.assessment.findMany({
        where: { ...where, day: { gte: today } },
        orderBy: { day: 'asc' },
        select,
      }),
      this.prisma.assessment.findMany({
        where: { ...where, day: { lt: today } },
        orderBy: { day: 'desc' },
        take: 10,
        select,
      }),
    ]);
    const shape = ({
      day,
      subject,
      period,
      grades,
      ...a
    }: (typeof past)[number]) => ({
      ...a,
      day: isoDay(day),
      subject: subject.name,
      period: period.name,
      score: grades[0] ? Number(grades[0].score) : null,
    });
    return { upcoming: upcoming.map(shape), past: past.map(shape) };
  }
}
