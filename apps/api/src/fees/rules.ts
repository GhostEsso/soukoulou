// Règles métier pures des frais de scolarité (sans base de données), testées dans rules.spec.ts.
import type { PayoutStatus, ReminderKind, Sex } from '@prisma/client';

export type Line = { position: number; amount: number; dueOn: Date };
export type Rule = {
  id: string;
  sex: Sex | null;
  levelIds: string[];
  lines: Line[];
};
export type Allocation = {
  position: number;
  amount: number;
  paid: number;
  remaining: number;
  dueOn: Date;
  overdue: boolean;
};

const DAY_MS = 86_400_000;
const DUE_SOON_DAYS = 7;
// Jour calendaire UTC (les échéances sont des @db.Date à minuit UTC).
const day = (d: Date) => Math.floor(d.getTime() / DAY_MS);

/** Règle applicable : celle du sexe de l'élève, sinon celle « pour tous ». */
export function resolveSchedule(
  rules: Rule[],
  levelId: string,
  sex: Sex,
): Rule | null {
  const forLevel = rules.filter((r) => r.levelIds.includes(levelId));
  return (
    forLevel.find((r) => r.sex === sex) ??
    forLevel.find((r) => r.sex === null) ??
    null
  );
}

/** Première classe en conflit (même classe et même sexe), ou null. */
export function findOverlap(
  rules: Rule[],
  candidate: Omit<Rule, 'id'> & { id?: string },
): string | null {
  for (const r of rules) {
    if (r.id === candidate.id || r.sex !== candidate.sex) continue;
    const hit = candidate.levelIds.find((l) => r.levelIds.includes(l));
    if (hit) return hit;
  }
  return null;
}

/** Message d'erreur, ou null si la grille est valide. */
export function validateLines(lines: Line[], maxLines: number): string | null {
  if (lines.length === 0) return 'Au moins une tranche.';
  if (lines.length > maxLines) return 'Plusieurs tranches : offre Standard.';
  if (lines.some((l) => !Number.isInteger(l.amount) || l.amount < 1))
    return 'Montant invalide.';
  for (let i = 1; i < lines.length; i++) {
    if (day(lines[i].dueOn) <= day(lines[i - 1].dueOn))
      return 'Les dates des tranches doivent se suivre.';
  }
  return null;
}

/** Répartit les paiements sur les tranches, dans l'ordre des positions. */
export function allocate(lines: Line[], paid: number, now: Date): Allocation[] {
  let left = paid;
  return [...lines]
    .sort((a, b) => a.position - b.position)
    .map((l) => {
      const p = Math.max(0, Math.min(l.amount, left));
      left -= p;
      const remaining = l.amount - p;
      return {
        position: l.position,
        amount: l.amount,
        paid: p,
        remaining,
        dueOn: l.dueOn,
        overdue: remaining > 0 && day(now) > day(l.dueOn),
      };
    });
}

/** Relances à envoyer : échéance dans ≤ 7 jours, ou échue. */
export function remindersDue(
  alloc: Allocation[],
  now: Date,
): { position: number; kind: ReminderKind }[] {
  const out: { position: number; kind: ReminderKind }[] = [];
  for (const a of alloc) {
    if (a.remaining <= 0) continue;
    if (a.overdue) out.push({ position: a.position, kind: 'OVERDUE' });
    else if (day(a.dueOn) - day(now) <= DUE_SOON_DAYS)
      out.push({ position: a.position, kind: 'DUE_SOON' });
  }
  return out;
}

export function receiptNumber(year: number, seq: number): string {
  return `REC-${year}-${String(seq).padStart(6, '0')}`;
}

/** Encaissé en ligne moins les décaissements demandés ou versés. */
export function availableForPayout(
  onlinePaid: number,
  payouts: { amount: number; status: PayoutStatus }[],
): number {
  const taken = payouts
    .filter((p) => p.status !== 'REJECTED')
    .reduce((s, p) => s + p.amount, 0);
  return onlinePaid - taken;
}
