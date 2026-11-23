import { hhmm, overlaps, toMin } from './rules';

describe('schedule rules', () => {
  it('parses and formats hours', () => {
    expect(toMin('08:30')).toBe(510);
    expect(toMin('8:30')).toBeNull();
    expect(toMin('24:00')).toBeNull();
    expect(hhmm(510)).toBe('08:30');
  });

  it('detects overlaps but allows back-to-back slots', () => {
    const a = { startMin: 480, endMin: 600 };
    expect(overlaps(a, { startMin: 540, endMin: 660 })).toBe(true);
    expect(overlaps(a, { startMin: 600, endMin: 660 })).toBe(false);
    expect(overlaps(a, { startMin: 420, endMin: 720 })).toBe(true);
  });
});
