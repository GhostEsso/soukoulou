import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { OnboardingService } from '../schools/onboarding.service';
import type { SlotDto, SlotQuery } from './dto';
import { hhmm, overlaps, toMin } from './rules';

const DAYS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const SLOT = {
  id: true,
  weekday: true,
  startMin: true,
  endMin: true,
  room: true,
  teaching: {
    select: {
      id: true,
      classroom: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, shortName: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} as const;

/** Emploi du temps hebdomadaire de l'année en cours. Tout est filtré par schoolId. */
@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly onboarding: OnboardingService,
  ) {}

  private async yearId(schoolId: string) {
    const y = await this.prisma.academicYear.findFirst({
      where: { schoolId },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      select: { id: true },
    });
    return y?.id ?? '';
  }

  async list(schoolId: string, q: SlotQuery) {
    const yearId = await this.yearId(schoolId);
    const rows = await this.prisma.scheduleSlot.findMany({
      where: {
        teaching: {
          classroom: { schoolId, yearId },
          ...(q.teacherId && { teacherId: q.teacherId }),
          ...(q.classroomId && { classroomId: q.classroomId }),
        },
      },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
      select: SLOT,
    });
    return rows.map(({ startMin, endMin, teaching: t, ...s }) => ({
      ...s,
      start: hhmm(startMin),
      end: hhmm(endMin),
      teachingId: t.id,
      classroom: t.classroom,
      subject: t.subject,
      teacher: {
        id: t.teacher.id,
        name: `${t.teacher.firstName} ${t.teacher.lastName}`,
      },
    }));
  }

  /** Ajoute un créneau ; refuse s'il chevauche un cours de la même classe ou du même enseignant. */
  async create(schoolId: string, dto: SlotDto) {
    const { access, denial } = await this.onboarding.can(schoolId, 'write');
    if (!access) throw new ForbiddenException(denial);
    const startMin = toMin(dto.start)!;
    const endMin = toMin(dto.end)!;
    if (endMin <= startMin)
      throw new BadRequestException(
        'L’heure de fin doit suivre l’heure de début.',
      );
    if (startMin < 6 * 60 || endMin > 20 * 60)
      throw new BadRequestException('Les cours ont lieu entre 06:00 et 20:00.');
    const t = await this.prisma.teachingAssignment.findFirst({
      where: { id: dto.teachingId, classroom: { schoolId } },
      select: { id: true, teacherId: true, classroomId: true },
    });
    if (!t) throw new NotFoundException('Cours introuvable.');
    const sameDay = await this.prisma.scheduleSlot.findMany({
      where: {
        weekday: dto.weekday,
        teaching: {
          OR: [{ teacherId: t.teacherId }, { classroomId: t.classroomId }],
        },
      },
      select: SLOT,
    });
    const clash = sameDay.find((s) => overlaps(s, { startMin, endMin }));
    if (clash) {
      const who =
        clash.teaching.classroom.id === t.classroomId
          ? `${clash.teaching.classroom.name} a déjà ${clash.teaching.subject.name}`
          : `l’enseignant est déjà en ${clash.teaching.classroom.name}`;
      throw new ConflictException(
        `Créneau occupé : ${who} le ${DAYS[clash.weekday]} de ${hhmm(clash.startMin)} à ${hhmm(clash.endMin)}.`,
      );
    }
    return this.prisma.scheduleSlot.create({
      data: {
        teachingId: t.id,
        weekday: dto.weekday,
        startMin,
        endMin,
        room: dto.room,
      },
      select: { id: true },
    });
  }

  async remove(schoolId: string, id: string) {
    const { access, denial } = await this.onboarding.can(schoolId, 'write');
    if (!access) throw new ForbiddenException(denial);
    const { count } = await this.prisma.scheduleSlot.deleteMany({
      where: { id, teaching: { classroom: { schoolId } } },
    });
    if (!count) throw new NotFoundException();
  }
}
