import {
  allocate,
  availableForPayout,
  findOverlap,
  receiptNumber,
  remindersDue,
  resolveSchedule,
  validateLines,
} from './rules';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const line = (position: number, amount: number, dueOn: string) => ({
  position,
  amount,
  dueOn: d(dueOn),
});

describe('resolveSchedule', () => {
  const tous = {
    id: 'tous',
    sex: null,
    levelIds: ['6e', '5e', '4e', '3e'],
    lines: [line(1, 40000, '2026-10-01')],
  };
  const filles = {
    id: 'filles',
    sex: 'FEMALE' as const,
    levelIds: ['6e', '5e', '4e', '3e'],
    lines: [line(1, 25000, '2026-10-01')],
  };
  it('préfère la règle spécifique au sexe', () => {
    expect(resolveSchedule([tous, filles], '5e', 'FEMALE')?.id).toBe('filles');
  });
  it('retombe sur la règle pour tous', () => {
    expect(resolveSchedule([tous, filles], '5e', 'MALE')?.id).toBe('tous');
  });
  it('retourne null sans règle', () => {
    expect(resolveSchedule([tous, filles], '2nde', 'MALE')).toBeNull();
  });
});

describe('findOverlap', () => {
  const base = { sex: null, levelIds: ['5e'], lines: [] };
  it('détecte deux règles pour tous sur la même classe', () => {
    expect(
      findOverlap([{ id: 'a', ...base }], { ...base, levelIds: ['6e', '5e'] }),
    ).toBe('5e');
  });
  it('tolère tous + filles', () => {
    expect(
      findOverlap([{ id: 'a', ...base }], { ...base, sex: 'FEMALE' }),
    ).toBeNull();
  });
  it('ignore la règle elle-même en édition', () => {
    expect(
      findOverlap([{ id: 'a', ...base }], { id: 'a', ...base }),
    ).toBeNull();
  });
});

describe('validateLines', () => {
  it('refuse 0 tranche', () => {
    expect(validateLines([], 3)).toBe('Au moins une tranche.');
  });
  it('refuse un montant nul', () => {
    expect(validateLines([line(1, 0, '2026-10-01')], 1)).toBe(
      'Montant invalide.',
    );
  });
  it('refuse des dates non croissantes', () => {
    expect(
      validateLines([line(1, 10, '2027-01-01'), line(2, 10, '2026-10-01')], 3),
    ).toBe('Les dates des tranches doivent se suivre.');
  });
  it('refuse trop de tranches', () => {
    expect(
      validateLines(
        [
          line(1, 1, '2026-10-01'),
          line(2, 1, '2026-11-01'),
          line(3, 1, '2026-12-01'),
        ],
        1,
      ),
    ).toBe('Plusieurs tranches : offre Standard.');
  });
  it('accepte une grille valide', () => {
    expect(validateLines([line(1, 10, '2026-10-01')], 1)).toBeNull();
  });
});

describe('allocate', () => {
  const lines = [line(1, 20000, '2026-10-01'), line(2, 20000, '2027-01-01')];
  it('remplit les tranches dans l’ordre', () => {
    expect(allocate(lines, 25000, d('2027-01-15'))).toEqual([
      {
        position: 1,
        amount: 20000,
        paid: 20000,
        remaining: 0,
        dueOn: d('2026-10-01'),
        overdue: false,
      },
      {
        position: 2,
        amount: 20000,
        paid: 5000,
        remaining: 15000,
        dueOn: d('2027-01-01'),
        overdue: true,
      },
    ]);
  });
});

describe('remindersDue', () => {
  const now = d('2026-10-10');
  const run = (due: string, paid = 0) =>
    remindersDue(allocate([line(1, 100, due)], paid, now), now);
  it('DUE_SOON à 7 jours', () => {
    expect(run('2026-10-17')).toEqual([{ position: 1, kind: 'DUE_SOON' }]);
  });
  it('rien à 8 jours', () => {
    expect(run('2026-10-18')).toEqual([]);
  });
  it('OVERDUE échue depuis 1 jour', () => {
    expect(run('2026-10-09')).toEqual([{ position: 1, kind: 'OVERDUE' }]);
  });
  it('rien si soldée', () => {
    expect(run('2026-10-09', 100)).toEqual([]);
  });
});

describe('receiptNumber', () => {
  it('formate', () => {
    expect(receiptNumber(2026, 42)).toBe('REC-2026-000042');
  });
});

describe('availableForPayout', () => {
  it('déduit demandés et versés, pas les rejetés', () => {
    expect(
      availableForPayout(100000, [
        { amount: 30000, status: 'PAID' },
        { amount: 20000, status: 'REQUESTED' },
        { amount: 10000, status: 'REJECTED' },
      ]),
    ).toBe(50000);
  });
});
