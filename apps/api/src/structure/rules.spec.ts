import { isYearLabel, splitYear, validateYear } from './rules';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);

describe('structure rules', () => {
  it('splits a year into 3 contiguous trimesters covering every day', () => {
    const p = splitYear(d('2026-10-01'), d('2027-05-31'), 'TRIMESTER');
    expect(p.map((x) => x.name)).toEqual([
      '1er trimestre',
      '2e trimestre',
      '3e trimestre',
    ]);
    expect(iso(p[0].startsOn)).toBe('2026-10-01');
    expect(iso(p[2].endsOn)).toBe('2027-05-31');
    for (let i = 1; i < p.length; i++) {
      expect(p[i].startsOn.getTime() - p[i - 1].endsOn.getTime()).toBe(
        86_400_000,
      );
    }
  });

  it('splits into 2 semesters', () => {
    const p = splitYear(d('2026-10-01'), d('2027-05-31'), 'SEMESTER');
    expect(p).toHaveLength(2);
    expect(p[1].name).toBe('2e semestre');
  });

  it('accepts generated periods', () => {
    const p = splitYear(d('2026-10-01'), d('2027-05-31'), 'TRIMESTER');
    expect(
      validateYear(d('2026-10-01'), d('2027-05-31'), 'TRIMESTER', p),
    ).toBeNull();
  });

  it('rejects overlap, wrong count, outside year, reversed year', () => {
    const p = splitYear(d('2026-10-01'), d('2027-05-31'), 'TRIMESTER');
    const overlap = [p[0], { ...p[1], startsOn: p[0].endsOn }, p[2]];
    expect(
      validateYear(d('2026-10-01'), d('2027-05-31'), 'TRIMESTER', overlap),
    ).toMatch(/chevauche/);
    expect(
      validateYear(d('2026-10-01'), d('2027-05-31'), 'SEMESTER', p),
    ).toMatch(/2 périodes/);
    const outside = [{ ...p[0], startsOn: d('2026-09-01') }, p[1], p[2]];
    expect(
      validateYear(d('2026-10-01'), d('2027-05-31'), 'TRIMESTER', outside),
    ).toMatch(/rester entre/);
    expect(
      validateYear(d('2027-05-31'), d('2026-10-01'), 'TRIMESTER', p),
    ).toMatch(/après la rentrée/);
  });

  it('validates year labels', () => {
    expect(isYearLabel('2026-2027')).toBe(true);
    expect(isYearLabel('2026-2028')).toBe(false);
    expect(isYearLabel('26-27')).toBe(false);
  });
});
