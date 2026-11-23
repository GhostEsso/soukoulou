/** Heures « HH:MM » ⇄ minutes depuis minuit. */

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toMin(s: string): number | null {
  const m = HHMM.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Deux créneaux du même jour se chevauchent (se toucher bout à bout est permis). */
export const overlaps = (
  a: { startMin: number; endMin: number },
  b: { startMin: number; endMin: number },
) => a.startMin < b.endMin && b.startMin < a.endMin;
