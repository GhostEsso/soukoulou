import type { PrismaClient } from '@prisma/client';
import { assignReceipt } from '../src/fees/cashbox.service';
import { FeesService } from '../src/fees/fees.service';
import type { PrismaService } from '../src/prisma/prisma.module';

/**
 * Frais de scolarité de l'école de démo : grille (6e-3e : filles 25 000 / garçons 40 000 en 2 tranches ;
 * 2nde-Tle : 70 000 en 3 tranches), dû des élèves inscrits, quelques encaissements en espèces avec reçu.
 * Idempotent : ne fait rien si l'année a déjà une grille.
 */
const COLLEGE = ['6e', '5e', '4e', '3e'];
const LYCEE = ['2nde', '1ère', 'Tle'];
const d = (s: string) => new Date(s);

export async function seedFees(
  prisma: PrismaClient,
  schoolId: string,
  yearId: string,
  cashierId: string,
) {
  if ((await prisma.feeSchedule.count({ where: { schoolId, yearId } })) > 0)
    return;
  const levels = await prisma.level.findMany({ where: { schoolId } });
  const ids = (names: string[]) =>
    levels.filter((l) => names.includes(l.name)).map((l) => ({ id: l.id }));
  const rule = (
    label: string,
    sex: 'MALE' | 'FEMALE' | null,
    names: string[],
    lines: [number, string][],
  ) =>
    prisma.feeSchedule.create({
      data: {
        schoolId,
        yearId,
        label,
        sex,
        levels: { connect: ids(names) },
        lines: {
          create: lines.map(([amount, dueOn], position) => ({
            position,
            amount,
            dueOn: d(dueOn),
          })),
        },
      },
    });
  await rule('Scolarité collège (filles)', 'FEMALE', COLLEGE, [
    [12500, '2026-10-31'],
    [12500, '2027-02-28'],
  ]);
  await rule('Scolarité collège (garçons)', 'MALE', COLLEGE, [
    [20000, '2026-10-31'],
    [20000, '2027-02-28'],
  ]);
  await rule('Scolarité lycée', null, LYCEE, [
    [25000, '2026-10-31'],
    [25000, '2027-01-31'],
    [20000, '2027-04-30'],
  ]);

  // Même résolution que l'API : le dû est figé à partir des règles ci-dessus.
  await new FeesService(prisma as unknown as PrismaService).applySchedules(
    schoolId,
    yearId,
  );

  const fees = await prisma.studentFee.findMany({
    where: { schoolId, yearId },
    include: { lines: { orderBy: { position: 'asc' } } },
    orderBy: { studentId: 'asc' },
  });
  const day = 86_400_000;
  for (const [i, f] of fees.entries()) {
    const due = f.lines.reduce((n, l) => n + l.amount, 0);
    const amount =
      i % 7 === 0 ? due : i % 3 === 0 ? f.lines[0].amount : i % 5 === 0 ? 5000 : 0;
    if (!amount) continue;
    const at = new Date(Date.now() - (1 + (i % 20)) * day);
    await prisma.$transaction(async (tx) => {
      const p = await tx.feePayment.create({
        data: {
          schoolId,
          studentFeeId: f.id,
          amount,
          method: 'CASH',
          status: 'PAID',
          recordedById: cashierId,
          paidAt: at,
        },
      });
      await assignReceipt(tx, schoolId, p.id, at);
    });
  }
}
