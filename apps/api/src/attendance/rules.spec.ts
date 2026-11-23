import { isoDay, parseDay, schoolWeek } from './rules';

describe('attendance rules', () => {
  it('parses only real calendar days', () => {
    expect(parseDay('2026-11-06')?.toISOString()).toBe(
      '2026-11-06T00:00:00.000Z',
    );
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('06/11/2026')).toBeNull();
  });

  it('returns Monday to Friday of the week', () => {
    const fromFriday = schoolWeek(parseDay('2026-11-06')!).map(isoDay);
    expect(fromFriday).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ]);
    expect(schoolWeek(parseDay('2026-11-08')!).map(isoDay)[0]).toBe(
      '2026-11-02',
    ); // dimanche
    expect(schoolWeek(parseDay('2026-11-02')!).map(isoDay)[0]).toBe(
      '2026-11-02',
    ); // lundi
  });
});
