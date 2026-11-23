import {
  appreciation,
  classResults,
  decide,
  mean,
  mention,
  on20,
  rankOf,
  weighted,
} from './rules';

describe('grade rules', () => {
  it('scales any scale to /20', () => {
    expect(on20(5, 10)).toBe(10);
    expect(on20(15, 20)).toBe(15);
    expect(on20(30, 40)).toBe(15);
  });

  it('averages and rounds, null when empty', () => {
    expect(mean([10, 12, 13])).toBe(11.67);
    expect(mean([])).toBeNull();
  });

  it('weights subject averages by coefficient, skipping ungraded subjects', () => {
    expect(
      weighted([
        { average: 12, coefficient: 4 },
        { average: 8, coefficient: 1 },
        { average: null, coefficient: 3 },
      ]),
    ).toBe(11.2);
    expect(weighted([{ average: null, coefficient: 2 }])).toBeNull();
  });

  it('ranks with ties sharing a place', () => {
    expect(rankOf(15, [12, 15, 15, 18])).toBe(2);
    expect(rankOf(12, [12, 15, 15, 18])).toBe(4);
  });

  it('computes class results per subject and overall', () => {
    const r = classResults(
      [
        { id: 'maths', coefficient: 4 },
        { id: 'eps', coefficient: 1 },
      ],
      [
        {
          subjectId: 'maths',
          maxScore: 10,
          grades: [{ studentId: 'a', score: 6 }],
        },
        {
          subjectId: 'maths',
          maxScore: 20,
          grades: [{ studentId: 'a', score: 14 }],
        },
        {
          subjectId: 'eps',
          maxScore: 20,
          grades: [
            { studentId: 'a', score: 8 },
            { studentId: 'b', score: 18 },
          ],
        },
      ],
      ['a', 'b'],
    );
    expect(r.get('a')!.subjects.get('maths')).toBe(13);
    expect(r.get('a')!.average).toBe(12);
    expect(r.get('b')!.subjects.get('maths')).toBeNull();
    expect(r.get('b')!.average).toBe(18);
  });

  it('maps averages to appreciations and mentions', () => {
    expect(appreciation(15.5)).toBe('Très bien');
    expect(appreciation(null)).toBeNull();
    expect(mention(12)).toBe('Tableau d’honneur');
    expect(mention(10)).toBeNull();
    expect(mention(7.5)).toBe('Avertissement travail');
  });

  it('proposes promotion from the pass mark', () => {
    expect(decide(10)).toBe('PROMOTED');
    expect(decide(9.99)).toBe('REPEATING');
    expect(decide(null)).toBeNull();
  });
});
