import { photoVersion } from '../storage/storage.module';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { ScheduleService } from '../schedule/schedule.service';

/**
 * Espace enseignant : un compte TEACHER ne voit que ses propres cours.
 * Chaque appel retrouve la fiche enseignant liée au compte, sinon 403.
 */
@Injectable()
export class TeacherSpaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedule: ScheduleService,
  ) {}

  /** Fiche liée au compte et ses cours de l'année en cours (classe + matière). */
  async whoami(userId: string, schoolId: string) {
    const t = await this.prisma.teacher.findFirst({
      where: { schoolId, userId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!t)
      throw new ForbiddenException(
        'Ce compte n’est pas celui d’un enseignant de cette école.',
      );
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      select: { id: true },
    });
    const teachings = await this.prisma.teachingAssignment.findMany({
      where: { teacherId: t.id, classroom: { yearId: year?.id ?? '' } },
      select: {
        classroom: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ classroom: { name: 'asc' } }, { subject: { name: 'asc' } }],
    });
    return { ...t, teachings };
  }

  async home(userId: string, schoolId: string) {
    const me = await this.whoami(userId, schoolId);
    const [school, slots] = await Promise.all([
      this.prisma.school.findUniqueOrThrow({
        where: { id: schoolId },
        select: { name: true, logoKey: true },
      }),
      this.schedule.list(schoolId, { teacherId: me.id }),
    ]);
    return {
      ...me,
      school: { name: school.name, logo: photoVersion(school.logoKey) },
      slots,
    };
  }

  /** Refuse une classe (et matière si donnée) qu'il n'enseigne pas. */
  async assertTeaches(
    userId: string,
    schoolId: string,
    classroomId: string,
    subjectId?: string,
  ) {
    const me = await this.whoami(userId, schoolId);
    const ok = me.teachings.some(
      (t) =>
        t.classroom.id === classroomId &&
        (!subjectId || t.subject.id === subjectId),
    );
    if (!ok)
      throw new ForbiddenException(
        subjectId
          ? 'Vous n’enseignez pas cette matière dans cette classe.'
          : 'Vous n’enseignez pas dans cette classe.',
      );
    return me;
  }

  /** Évaluation appartenant à l'un de ses cours. */
  async assertAssessment(userId: string, schoolId: string, id: string) {
    const a = await this.prisma.assessment.findFirst({
      where: { id, classroom: { schoolId } },
      select: { classroomId: true, subjectId: true },
    });
    if (!a) throw new NotFoundException();
    await this.assertTeaches(userId, schoolId, a.classroomId, a.subjectId);
  }
}
