/** Jours d'appel au format « AAAA-MM-JJ », calculés en UTC (colonne @db.Date). */

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(s: string): Date | null {
  if (!ISO.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s
    ? null
    : d;
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Les 5 jours ouvrés (lundi → vendredi) de la semaine qui contient `d`. */
export function schoolWeek(d: Date): Date[] {
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY);
  return Array.from(
    { length: 5 },
    (_, i) => new Date(monday.getTime() + i * DAY),
  );
}
