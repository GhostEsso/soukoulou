import { MailService } from '../mail/mail.module';
import type { NotificationsService } from '../notifications/notifications.module';
import { PrismaService } from '../prisma/prisma.module';
import { FEATURES } from '../schools/rules';
import { fmt } from './cashbox.service';
import { allocate, remindersDue } from './rules';

const dmy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

/**
 * Relances des tranches (échéance dans ≤ 7 jours, ou échue) aux parents ayant un email.
 * La relance est enregistrée avant l'envoi : seules les lignes réellement insérées par ce passage
 * déclenchent un email (passage répété ou concurrent = pas de doublon). Sans parent joignable,
 * la relance est tout de même enregistrée. Retourne le nombre d'emails envoyés.
 */
export async function sendFeeReminders(
  prisma: PrismaService,
  mail: MailService,
  now: Date,
  notifications?: NotificationsService,
): Promise<number> {
  const fees = await prisma.studentFee.findMany({
    where: {
      year: { isCurrent: true },
      school: {
        subscriptionStatus: 'ACTIVE',
        plan: { features: { has: FEATURES.FEE_TRACKING } },
      },
    },
    select: {
      id: true,
      createdAt: true,
      schoolId: true,
      studentId: true,
      school: { select: { name: true } },
      student: {
        select: {
          firstName: true,
          lastName: true,
          parents: { select: { parent: { select: { email: true } } } },
        },
      },
      lines: { select: { position: true, amount: true, dueOn: true } },
      payments: { where: { status: 'PAID' }, select: { amount: true } },
    },
  });

  let sent = 0;
  for (const f of fees) {
    const paid = f.payments.reduce((s, p) => s + p.amount, 0);
    const alloc = allocate(f.lines, paid, now);
    const created = f.createdAt.toISOString().slice(0, 10);
    for (const r of remindersDue(alloc, now)) {
      // Tranche déjà échue à la création du dû : paiements antérieurs inconnus, pas de relance.
      const due = alloc.find((x) => x.position === r.position)!.dueOn;
      if (due.toISOString().slice(0, 10) < created) continue;
      const ins = await prisma.feeReminder.createMany({
        data: [{ studentFeeId: f.id, position: r.position, kind: r.kind }],
        skipDuplicates: true,
      });
      if (!ins.count) continue;
      const a = alloc.find((x) => x.position === r.position)!;
      const subject =
        r.kind === 'OVERDUE'
          ? `Frais de scolarité : tranche n°${r.position} en retard`
          : `Frais de scolarité : tranche n°${r.position} à régler avant le ${dmy(a.dueOn)}`;
      const text = `Élève : ${f.student.firstName} ${f.student.lastName}\nReste à payer sur cette tranche : ${fmt(a.remaining)} FCFA\nÉcole : ${f.school.name}`;
      for (const p of f.student.parents) {
        if (!p.parent.email) continue;
        mail.send({ to: p.parent.email, subject, text });
        sent++;
      }
      await notifications?.toFamily(
        f.schoolId,
        f.studentId,
        { kind: 'FEE_REMINDER', title: subject, body: text },
        { student: false },
      );
    }
  }
  return sent;
}
