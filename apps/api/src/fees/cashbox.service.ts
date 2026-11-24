import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { CashDto } from './dto';
import { allocate, availableForPayout, receiptNumber } from './rules';

export type BalanceQuery = {
  yearId?: string;
  classroomId?: string;
  status?: 'unpaid' | 'overdue' | 'paid';
};

/** Encaissé en ligne (hors espèces) ; accepte un client de transaction. */
export async function onlineCollected(
  db: Pick<PrismaService, 'feePayment'>,
  schoolId: string,
) {
  const r = await db.feePayment.aggregate({
    where: { schoolId, status: 'PAID', method: { not: 'CASH' } },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

export const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/\s/g, ' ');

/** Attribue le numéro de reçu (compteur de l'école, jamais remis à zéro) ; à appeler dans la transaction du passage à PAID. */
export async function assignReceipt(
  tx: Prisma.TransactionClient,
  schoolId: string,
  paymentId: string,
  at: Date,
): Promise<string> {
  // SQL brut : un update Prisma ferait avancer School.updatedAt (file de vérification de la plateforme).
  const [{ receiptSeq }] = await tx.$queryRaw<{ receiptSeq: number }[]>`
    UPDATE "School" SET "receiptSeq" = "receiptSeq" + 1 WHERE id = ${schoolId} RETURNING "receiptSeq"`;
  const number = receiptNumber(at.getUTCFullYear(), receiptSeq);
  await tx.feePayment.update({
    where: { id: paymentId },
    data: { receiptNumber: number },
  });
  return number;
}

const feeInclude = {
  lines: true,
  payments: { where: { status: 'PAID' as const } },
  student: {
    select: {
      firstName: true,
      lastName: true,
      enrollments: {
        select: {
          yearId: true,
          classroom: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.StudentFeeInclude;

@Injectable()
export class CashboxService {
  constructor(private readonly prisma: PrismaService) {}

  /** Année de référence : l'année demandée, sinon la courante, sinon la plus récente. */
  async yearId(schoolId: string, yearId?: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId, ...(yearId && { id: yearId }) },
      orderBy: [{ isCurrent: 'desc' }, { startsOn: 'desc' }],
      select: { id: true },
    });
    if (yearId && !year) throw new NotFoundException('Année introuvable.');
    return year?.id ?? null;
  }

  /** Dû, payé et reste de chaque élève ayant des frais pour l'année. */
  private async rows(schoolId: string, yearId: string, classroomId?: string) {
    const fees = await this.prisma.studentFee.findMany({
      where: {
        schoolId,
        yearId,
        ...(classroomId && {
          student: { enrollments: { some: { yearId, classroomId } } },
        }),
      },
      include: feeInclude,
      orderBy: [
        { student: { lastName: 'asc' } },
        { student: { firstName: 'asc' } },
      ],
    });
    const now = new Date();
    return fees.map((f) => {
      const due = f.lines.reduce((s, l) => s + l.amount, 0);
      const paid = f.payments.reduce((s, p) => s + p.amount, 0);
      const alloc = allocate(f.lines, paid, now);
      const cls = f.student.enrollments.find(
        (e) => e.yearId === yearId,
      )?.classroom;
      return {
        studentId: f.studentId,
        name: `${f.student.firstName} ${f.student.lastName}`,
        classroomId: cls?.id ?? null,
        classroom: cls?.name ?? null,
        due,
        paid,
        remaining: due - paid,
        overdue: alloc.some((a) => a.overdue),
        overdueAmount: alloc
          .filter((a) => a.overdue)
          .reduce((s, a) => s + a.remaining, 0),
      };
    });
  }

  async balances(schoolId: string, q: BalanceQuery) {
    const yearId = await this.yearId(schoolId, q.yearId);
    if (!yearId) return [];
    const rows = await this.rows(schoolId, yearId, q.classroomId);
    return rows
      .filter(
        (r) =>
          !q.status ||
          (q.status === 'paid' && r.remaining === 0) ||
          (q.status === 'unpaid' && r.remaining > 0) ||
          (q.status === 'overdue' && r.overdue),
      )
      .map((r) => ({
        studentId: r.studentId,
        name: r.name,
        classroom: r.classroom,
        due: r.due,
        paid: r.paid,
        remaining: r.remaining,
        overdue: r.overdue,
      }));
  }

  async studentFee(schoolId: string, studentId: string, yearId?: string) {
    const y = await this.yearId(schoolId, yearId);
    if (!y) return null;
    const f = await this.prisma.studentFee.findFirst({
      where: { schoolId, studentId, yearId: y },
      include: {
        lines: true,
        payments: { where: { status: 'PAID' }, orderBy: { paidAt: 'asc' } },
      },
    });
    if (!f) return null;
    const paid = f.payments.reduce((s, p) => s + p.amount, 0);
    return {
      label: f.label,
      lines: allocate(f.lines, paid, new Date()),
      payments: f.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        receiptNumber: p.receiptNumber,
        paidAt: p.paidAt,
      })),
    };
  }

  async recordCash(schoolId: string, userId: string, dto: CashDto) {
    const y = await this.yearId(schoolId);
    const fee = y
      ? await this.prisma.studentFee.findFirst({
          where: { schoolId, studentId: dto.studentId, yearId: y },
          select: { id: true },
        })
      : null;
    if (!fee) throw new NotFoundException('Aucun frais pour cet élève.');

    return this.prisma.$transaction(async (tx) => {
      // Verrou sur le dû : deux encaissements simultanés se suivent au lieu de se croiser.
      await tx.$queryRaw`SELECT id FROM "StudentFee" WHERE id = ${fee.id} FOR UPDATE`;
      const [lines, paid] = await Promise.all([
        tx.studentFeeLine.aggregate({
          where: { studentFeeId: fee.id },
          _sum: { amount: true },
        }),
        tx.feePayment.aggregate({
          where: { studentFeeId: fee.id, status: 'PAID' },
          _sum: { amount: true },
        }),
      ]);
      const remaining = (lines._sum.amount ?? 0) - (paid._sum.amount ?? 0);
      if (dto.amount > remaining)
        throw new BadRequestException(
          `Le montant dépasse le reste à payer (${fmt(remaining)} FCFA).`,
        );
      const now = new Date();
      const p = await tx.feePayment.create({
        data: {
          schoolId,
          studentFeeId: fee.id,
          amount: dto.amount,
          method: 'CASH',
          status: 'PAID',
          recordedById: userId,
          paidAt: now,
        },
      });
      const number = await assignReceipt(tx, schoolId, p.id, now);
      return { ...p, receiptNumber: number };
    });
  }

  async receipt(schoolId: string, paymentId: string) {
    const p = await this.prisma.feePayment.findFirst({
      where: { id: paymentId, schoolId, status: 'PAID' },
      include: {
        school: { select: { name: true } },
        studentFee: {
          include: {
            lines: true,
            payments: { where: { status: 'PAID' } },
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Reçu introuvable.');
    const f = p.studentFee;
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId: f.studentId, yearId: f.yearId },
      select: { classroom: { select: { name: true } } },
    });
    const due = f.lines.reduce((s, l) => s + l.amount, 0);
    const paid = f.payments.reduce((s, x) => s + x.amount, 0);
    return {
      number: p.receiptNumber,
      school: { name: p.school.name },
      student: { name: `${f.student.firstName} ${f.student.lastName}` },
      classroom: enrollment?.classroom.name ?? null,
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt,
      remaining: due - paid,
    };
  }

  async dashboard(schoolId: string, yearId?: string) {
    const y = await this.yearId(schoolId, yearId);
    const rows = y ? await this.rows(schoolId, y, undefined) : [];
    const sum = (k: 'due' | 'paid' | 'overdueAmount', r = rows) =>
      r.reduce((s, x) => s + x[k], 0);
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = r.classroomId ?? '';
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    const byClassroom = [...groups.entries()].map(([classroomId, r]) => ({
      classroomId: classroomId || null,
      classroom: r[0].classroom,
      due: sum('due', r),
      collected: sum('paid', r),
      remaining: sum('due', r) - sum('paid', r),
      overdue: sum('overdueAmount', r),
    }));
    const [online, payouts] = await Promise.all([
      onlineCollected(this.prisma, schoolId),
      this.prisma.payout.findMany({
        where: { schoolId },
        select: { amount: true, status: true },
      }),
    ]);
    const collected = online;
    return {
      due: sum('due'),
      collected: sum('paid'),
      remaining: sum('due') - sum('paid'),
      overdue: sum('overdueAmount'),
      byClassroom,
      online: { collected, available: availableForPayout(collected, payouts) },
    };
  }
}
