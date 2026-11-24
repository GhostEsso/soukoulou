import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isoDay, parseDay } from '../attendance/rules';
import { PrismaService } from '../prisma/prisma.module';
import { FEATURES } from '../schools/rules';
import { ScheduleDto } from './dto';
import { findOverlap, resolveSchedule, validateLines } from './rules';
import type { Line, Rule } from './rules';

const include = {
  levels: { select: { id: true, name: true } },
  lines: { orderBy: { position: 'asc' } },
} as const;

type Row = {
  id: string;
  sex: Rule['sex'];
  levels: { id: string }[];
  lines: Line[];
};
const toRule = (r: Row): Rule => ({
  id: r.id,
  sex: r.sex,
  levelIds: r.levels.map((l) => l.id),
  lines: r.lines,
});

@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  async listSchedules(schoolId: string, yearId: string) {
    const rows = await this.prisma.feeSchedule.findMany({
      where: { schoolId, yearId },
      include,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      ...r,
      lines: r.lines.map((l) => ({ ...l, dueOn: isoDay(l.dueOn) })),
    }));
  }

  createSchedule(schoolId: string, dto: ScheduleDto) {
    return this.save(schoolId, null, dto);
  }

  updateSchedule(schoolId: string, id: string, dto: ScheduleDto) {
    return this.save(schoolId, id, dto);
  }

  async deleteSchedule(schoolId: string, id: string) {
    // Les montants déjà figés restent : StudentFee.scheduleId passe à null.
    const { count } = await this.prisma.feeSchedule.deleteMany({
      where: { id, schoolId },
    });
    if (!count) throw new NotFoundException('Règle introuvable.');
  }

  private async save(schoolId: string, id: string | null, dto: ScheduleDto) {
    if (id) await this.own(schoolId, id);
    const year = await this.prisma.academicYear.findFirst({
      where: { id: dto.yearId, schoolId },
      select: { id: true },
    });
    if (!year) throw new NotFoundException('Année introuvable.');
    const levelIds = [...new Set(dto.levelIds)];
    const levels = await this.prisma.level.findMany({
      where: { schoolId, id: { in: levelIds } },
      select: { id: true, name: true },
    });
    if (levels.length !== levelIds.length)
      throw new BadRequestException('Niveau introuvable.');

    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { plan: { select: { features: true } } },
    });
    const maxLines = school.plan?.features.includes(FEATURES.FEE_TRACKING)
      ? 12
      : 1;
    const lines: Line[] = [];
    for (const [i, l] of dto.lines.entries()) {
      const dueOn = parseDay(l.dueOn);
      if (!dueOn) throw new BadRequestException('Date invalide.');
      lines.push({ position: i + 1, amount: l.amount, dueOn });
    }
    const bad = validateLines(lines, maxLines);
    if (bad) throw new BadRequestException(bad);

    const others = await this.prisma.feeSchedule.findMany({
      where: { schoolId, yearId: dto.yearId },
      include,
    });
    const clash = findOverlap(others.map(toRule), {
      id: id ?? undefined,
      sex: dto.sex,
      levelIds,
      lines,
    });
    if (clash) {
      const name = levels.find((l) => l.id === clash)?.name;
      throw new BadRequestException(
        `Le niveau ${name} a déjà des frais pour ce public.`,
      );
    }

    const data = {
      label: dto.label ?? 'Scolarité',
      sex: dto.sex,
      levels: { set: levelIds.map((l) => ({ id: l })) },
    };
    const saved = await this.prisma.$transaction(async (tx) => {
      if (id) {
        await tx.feeScheduleLine.deleteMany({ where: { scheduleId: id } });
        await tx.feeSchedule.update({ where: { id }, data });
      }
      const s = id
        ? { id }
        : await tx.feeSchedule.create({
            data: {
              schoolId,
              yearId: dto.yearId,
              ...data,
              levels: { connect: levelIds.map((l) => ({ id: l })) },
            },
            select: { id: true },
          });
      await tx.feeScheduleLine.createMany({
        data: lines.map((l) => ({ ...l, scheduleId: s.id })),
      });
      return s;
    });
    await this.applySchedules(schoolId, dto.yearId);
    return saved;
  }

  private async own(schoolId: string, id: string) {
    const s = await this.prisma.feeSchedule.findFirst({
      where: { id, schoolId },
      select: { id: true },
    });
    if (!s) throw new NotFoundException('Règle introuvable.');
  }

  /** Fige le dû des élèves inscrits qui n'en ont pas encore ; ne modifie jamais un dû existant. */
  async applySchedules(
    schoolId: string,
    yearId: string,
  ): Promise<{ created: number }> {
    const schedules = await this.prisma.feeSchedule.findMany({
      where: { schoolId, yearId },
      include,
    });
    if (!schedules.length) return { created: 0 };
    const rules = schedules.map(toRule);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { yearId, student: { schoolId, fees: { none: { yearId } } } },
      select: {
        studentId: true,
        classroom: { select: { levelId: true } },
        student: { select: { sex: true } },
      },
    });
    const picks = enrollments.flatMap((e) => {
      const r = resolveSchedule(rules, e.classroom.levelId, e.student.sex);
      return r ? [{ studentId: e.studentId, rule: r }] : [];
    });
    if (!picks.length) return { created: 0 };
    const labels = new Map(schedules.map((s) => [s.id, s.label]));

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.studentFee.createMany({
        data: picks.map((p) => ({
          schoolId,
          studentId: p.studentId,
          yearId,
          scheduleId: p.rule.id,
          label: labels.get(p.rule.id)!,
        })),
        skipDuplicates: true,
      });
      const fees = await tx.studentFee.findMany({
        where: { yearId, studentId: { in: picks.map((p) => p.studentId) } },
        select: { id: true, studentId: true },
      });
      const byStudent = new Map(fees.map((f) => [f.studentId, f.id]));
      await tx.studentFeeLine.createMany({
        data: picks.flatMap((p) =>
          p.rule.lines.map((l) => ({
            studentFeeId: byStudent.get(p.studentId)!,
            position: l.position,
            amount: l.amount,
            dueOn: l.dueOn,
          })),
        ),
        skipDuplicates: true,
      });
      return { created: count };
    });
  }
}
