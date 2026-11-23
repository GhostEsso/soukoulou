import { PrismaClient } from '@prisma/client';
import { grantAccess, resetAccess } from '../src/auth/accounts';

const RUN = Date.now().toString(36); // la base de test n'est jamais vidée : données uniques par exécution
const prisma = new PrismaClient();
const phone = (n: number) =>
  `+2289${(Date.now() % 1_000_000).toString().padStart(6, '0')}${n}`;

/** Accès créés par une école : une école ne doit jamais prendre le compte d'une autre. */
describe('Comptes créés par les écoles (e2e)', () => {
  const school = (name: string) =>
    prisma.school.create({
      data: {
        name: `${name} ${RUN}`,
        type: 'HIGH',
        country: 'TG',
        city: 'Lomé',
      },
    });
  const grant = (
    schoolId: string,
    p: { phone?: string; matricule?: string; role: 'TEACHER' | 'STUDENT' },
  ) =>
    prisma.$transaction((tx) =>
      grantAccess(tx, {
        schoolId,
        role: p.role,
        phone: p.phone ?? null,
        matricule: p.matricule,
        firstName: 'Kossi',
        lastName: 'Agbo',
      }),
    );

  afterAll(() => prisma.$disconnect());

  it('une autre école ne peut pas réinitialiser le code d’un compte partagé', async () => {
    const a = await school('École A');
    const b = await school('École B');
    const tel = phone(1);
    const mine = await grant(a.id, { phone: tel, role: 'TEACHER' });
    expect(mine.code).toBeTruthy();

    // L'école B rattache le même numéro : pas de code, puis réinitialisation refusée.
    const linked = await grant(b.id, { phone: tel, role: 'TEACHER' });
    expect(linked).toEqual({ userId: mine.userId, login: tel, code: null });
    await expect(
      prisma.$transaction((tx) => resetAccess(tx, mine.userId, b.id)),
    ).rejects.toThrow('autre école');
    // L'école A non plus, tant que le compte sert ailleurs.
    await expect(
      prisma.$transaction((tx) => resetAccess(tx, mine.userId, a.id)),
    ).rejects.toThrow('autre école');
  });

  it('compte d’une seule école : réinitialisation possible', async () => {
    const a = await school('École C');
    const r = await grant(a.id, { phone: phone(2), role: 'TEACHER' });
    const reset = await prisma.$transaction((tx) =>
      resetAccess(tx, r.userId, a.id),
    );
    expect(reset.code).toHaveLength(10);
  });

  it('un matricule au format téléphone est refusé comme identifiant', async () => {
    const a = await school('École D');
    await expect(
      grant(a.id, { matricule: phone(3), role: 'STUDENT' }),
    ).rejects.toThrow('numéro de téléphone');
    await expect(
      grant(a.id, { matricule: '90123456', role: 'STUDENT' }),
    ).rejects.toThrow('numéro de téléphone');
    const ok = await grant(a.id, { matricule: `PAL-${RUN}`, role: 'STUDENT' });
    expect(ok.code).toBeTruthy();
  });
});
