import {
  ALL_FEATURES,
  amountFor,
  checkAccess,
  FEATURES,
  isOverdue,
  isSlugAllowed,
  periodFor,
  requirementApplies,
  sniffMime,
  contrastWithWhite,
} from './rules';

const active = {
  subscriptionStatus: 'ACTIVE' as const,
  verificationStatus: 'VERIFIED' as const,
  planFeatures: [FEATURES.CORE, FEATURES.HOMEWORK],
  hasOverdueDocument: false,
};

describe('checkAccess', () => {
  it('mode découverte : rien de réel', () => {
    const s = { ...active, subscriptionStatus: 'DISCOVERY' as const };
    expect(checkAccess(s, 'read')).toBe('DISCOVERY');
  });

  it('vacances : lecture seule', () => {
    const s = { ...active, subscriptionStatus: 'READ_ONLY' as const };
    expect(checkAccess(s, 'read')).toBeNull();
    expect(checkAccess(s, 'write')).toBe('READ_ONLY');
  });

  it('payée mais non vérifiée : configure, mais ne publie ni n’invite', () => {
    const s = { ...active, verificationStatus: 'PENDING' as const };
    expect(checkAccess(s, 'write')).toBeNull();
    expect(checkAccess(s, 'publish')).toBe('NOT_VERIFIED');
    expect(checkAccess(s, 'invite')).toBe('NOT_VERIFIED');
    expect(checkAccess(s, 'collect')).toBe('NOT_VERIFIED');
  });

  it('fonctionnalité hors offre', () => {
    expect(checkAccess(active, 'write', FEATURES.EXPORTS)).toBe('PLAN');
    expect(checkAccess(active, 'write', FEATURES.HOMEWORK)).toBeNull();
  });

  it('pièce en retard : blocage partiel seulement', () => {
    const s = { ...active, hasOverdueDocument: true };
    expect(checkAccess(s, 'publish')).toBeNull();
    expect(checkAccess(s, 'invite')).toBe('DOCUMENT_OVERDUE');
    expect(checkAccess(s, 'collect')).toBe('DOCUMENT_OVERDUE');
  });

  it('décaissement : permis abonnement expiré ou hors offre, pas suspendu ni non vérifié', () => {
    const lapsed = { ...active, subscriptionStatus: 'READ_ONLY' as const };
    expect(checkAccess(lapsed, 'payout')).toBeNull();
    expect(checkAccess({ ...active, planFeatures: [] }, 'payout')).toBeNull();
    expect(
      checkAccess({ ...active, subscriptionStatus: 'SUSPENDED' }, 'payout'),
    ).toBe('SUSPENDED');
    expect(
      checkAccess({ ...active, verificationStatus: 'PENDING' }, 'payout'),
    ).toBe('NOT_VERIFIED');
    expect(checkAccess({ ...active, hasOverdueDocument: true }, 'payout')).toBe(
      'DOCUMENT_OVERDUE',
    );
  });
});

describe('requirementApplies / isOverdue', () => {
  const base = {
    isActive: true,
    isMandatory: true,
    countries: [] as string[],
    schoolTypes: [],
    ownerships: [],
    appliesToExisting: false,
    dueDate: null,
    createdAt: new Date('2026-06-01'),
  };
  const school = {
    country: 'TG',
    type: 'HIGH' as const,
    ownership: 'PRIVATE_FAITH' as const,
    verifiedAt: null,
  };

  it('cible pays et statut', () => {
    expect(requirementApplies({ ...base, countries: ['TG'] }, school)).toBe(
      true,
    );
    expect(requirementApplies({ ...base, countries: ['BJ'] }, school)).toBe(
      false,
    );
    expect(
      requirementApplies({ ...base, ownerships: ['PUBLIC'] }, school),
    ).toBe(false);
  });

  it('pièce ajoutée après vérification : seulement si appliesToExisting', () => {
    const verified = { ...school, verifiedAt: new Date('2026-01-01') };
    expect(requirementApplies(base, verified)).toBe(false);
    expect(
      requirementApplies({ ...base, appliesToExisting: true }, verified),
    ).toBe(true);
  });

  it('retard', () => {
    const req = {
      ...base,
      appliesToExisting: true,
      dueDate: new Date('2026-07-01'),
    };
    const now = new Date('2026-07-02');
    expect(isOverdue(req, undefined, now)).toBe(true);
    expect(isOverdue(req, { reviewStatus: 'PENDING' }, now)).toBe(false);
    expect(isOverdue(req, undefined, new Date('2026-06-15'))).toBe(false);
  });
});

describe('facturation', () => {
  const plan = {
    priceMonthly: 25_000,
    schoolYearMonths: 8,
    schoolYearFreeMonths: 1,
  };
  it('1 mois offert sur l’année scolaire', () => {
    expect(amountFor(plan, 'MONTHLY')).toBe(25_000);
    expect(amountFor(plan, 'SCHOOL_YEAR')).toBe(175_000);
    expect(amountFor({ ...plan, priceMonthly: 75_000 }, 'SCHOOL_YEAR')).toBe(
      525_000,
    );
  });

  it('renouvellement anticipé prolonge la période', () => {
    const now = new Date('2026-10-10');
    const p = periodFor('MONTHLY', 8, now, new Date('2026-10-20'));
    expect(p.start.toISOString().slice(0, 10)).toBe('2026-10-20');
    expect(p.end.toISOString().slice(0, 10)).toBe('2026-11-20');
  });
});

describe('divers', () => {
  it('fonctionnalité fee_tracking', () => {
    expect(ALL_FEATURES).toContain('fee_tracking');
  });

  it('adresse', () => {
    expect(isSlugAllowed('lycee-espoir')).toBe(true);
    expect(isSlugAllowed('admin')).toBe(false);
    expect(isSlugAllowed('-x')).toBe(false);
    expect(isSlugAllowed('Lycee')).toBe(false);
  });

  it('contenu réel du fichier', () => {
    expect(sniffMime(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffMime(Buffer.from('<html>'))).toBeNull();
  });
});

describe('couleur de l’école', () => {
  it('refuse une couleur trop claire pour du texte blanc', () => {
    expect(contrastWithWhite('#2346C8')).toBeGreaterThan(4.5);
    expect(contrastWithWhite('#FFD700')).toBeLessThan(4.5);
  });
});
