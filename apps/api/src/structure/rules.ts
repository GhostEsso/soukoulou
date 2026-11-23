/**
 * Règles pures de la structure de l'école (sans base de données), testées dans rules.spec.ts.
 */

export type PeriodType = 'TRIMESTER' | 'SEMESTER';

export interface PeriodInput {
  name: string;
  startsOn: Date;
  endsOn: Date;
}

const DAY = 86_400_000;
const utcDay = (d: Date) =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export const periodCount = (t: PeriodType) => (t === 'TRIMESTER' ? 3 : 2);

const ORDINAL = ['1er', '2e', '3e'];
export const periodName = (t: PeriodType, i: number) =>
  `${ORDINAL[i]} ${t === 'TRIMESTER' ? 'trimestre' : 'semestre'}`;

/**
 * Découpe l'année en périodes de durées égales (au jour près), contiguës.
 * L'école ajuste ensuite les dates si son calendrier diffère.
 */
export function splitYear(
  startsOn: Date,
  endsOn: Date,
  type: PeriodType,
): PeriodInput[] {
  const n = periodCount(type);
  const start = utcDay(startsOn);
  const days = Math.round((utcDay(endsOn) - start) / DAY) + 1;
  const out: PeriodInput[] = [];
  let from = start;
  for (let i = 0; i < n; i++) {
    const len = Math.round((days * (i + 1)) / n) - Math.round((days * i) / n);
    const to = from + (len - 1) * DAY;
    out.push({
      name: periodName(type, i),
      startsOn: new Date(from),
      endsOn: new Date(to),
    });
    from = to + DAY;
  }
  return out;
}

/** Libellé « 2026-2027 » : deux années qui se suivent. */
export function isYearLabel(label: string): boolean {
  const m = /^(\d{4})-(\d{4})$/.exec(label);
  return Boolean(m && Number(m[2]) === Number(m[1]) + 1);
}

/**
 * Vérifie l'année et ses périodes. Renvoie un message d'erreur en français, ou null.
 * Les périodes doivent être dans l'ordre, sans chevauchement, et tenir dans l'année.
 */
export function validateYear(
  startsOn: Date,
  endsOn: Date,
  type: PeriodType,
  periods: PeriodInput[],
): string | null {
  if (utcDay(endsOn) <= utcDay(startsOn)) {
    return 'La fin de l’année doit être après la rentrée.';
  }
  if (utcDay(endsOn) - utcDay(startsOn) > 366 * DAY) {
    return 'Une année scolaire ne peut pas dépasser un an.';
  }
  if (periods.length !== periodCount(type)) {
    return `Il faut ${periodCount(type)} périodes pour ${type === 'TRIMESTER' ? 'des trimestres' : 'des semestres'}.`;
  }
  const outside = periods.some(
    (p) =>
      utcDay(p.startsOn) < utcDay(startsOn) ||
      utcDay(p.endsOn) > utcDay(endsOn),
  );
  if (outside) {
    return 'Les périodes doivent rester entre la rentrée et la fin de l’année.';
  }
  let prevEnd = utcDay(startsOn) - DAY;
  for (const p of periods) {
    const s = utcDay(p.startsOn);
    const e = utcDay(p.endsOn);
    if (!p.name.trim()) return 'Chaque période doit avoir un nom.';
    if (e < s) return `${p.name} : la fin est avant le début.`;
    if (s <= prevEnd) return `${p.name} chevauche la période précédente.`;
    prevEnd = e;
  }
  return null;
}
