import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { FEATURES as F } from '../src/schools/rules';
import { seedDemo } from './seed-demo';

const prisma = new PrismaClient();

const ESSENTIEL = [F.CORE];
const STANDARD = [
  ...ESSENTIEL,
  F.HOMEWORK,
  F.MESSAGING,
  F.FEE_PAYMENTS,
  F.CASHBOX,
];
const PREMIUM = [
  ...STANDARD,
  F.CUSTOM_REPORT_CARDS,
  F.ADVANCED_STATS,
  F.EXPORTS,
  F.SMS,
  F.PRIORITY_SUPPORT,
  F.CUSTOM_THEME,
];

async function main() {
  const plans = [
    {
      code: 'ESSENTIEL',
      name: 'Essentiel',
      priceMonthly: 25_000,
      rank: 1,
      features: ESSENTIEL,
    },
    {
      code: 'STANDARD',
      name: 'Standard',
      priceMonthly: 50_000,
      rank: 2,
      features: STANDARD,
    },
    {
      code: 'PREMIUM',
      name: 'Premium',
      priceMonthly: 75_000,
      rank: 3,
      features: PREMIUM,
    },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({
      where: { code: p.code },
      create: p,
      update: { features: p.features },
    });
  }

  if ((await prisma.documentRequirement.count()) === 0) {
    await prisma.documentRequirement.createMany({
      data: [
        {
          name: 'Autorisation d’ouverture',
          description: 'Délivrée par le ministère de l’Éducation.',
          countries: [],
          schoolTypes: [],
          ownerships: [],
          checkpoints: [
            'Le nom de l’école correspond aux informations saisies',
            'Le numéro d’autorisation correspond',
          ],
        },
        {
          name: 'Pièce d’identité du responsable',
          description: 'Carte d’identité ou passeport en cours de validité.',
          countries: [],
          schoolTypes: [],
          ownerships: [],
          checkpoints: [
            'Le nom correspond au responsable',
            'La pièce n’est pas expirée',
          ],
        },
      ],
    });
  }

  await prisma.schoolCalendar.upsert({
    where: {
      country_schoolYearLabel: { country: 'TG', schoolYearLabel: '2026-2027' },
    },
    create: {
      country: 'TG',
      schoolYearLabel: '2026-2027',
      startsOn: new Date('2026-10-01'),
      endsOn: new Date('2027-05-31'),
    },
    update: {},
  });

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: await hash(password),
        firstName: 'Admin',
        lastName: 'Soukoulou',
        isPlatformAdmin: true,
        emailVerifiedAt: new Date(),
      },
      update: {},
    });
  } else {
    console.warn(
      'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD absents : aucun admin créé.',
    );
  }

  // Développement seulement : école de démo avec sa structure.
  const demoEmail = process.env.SEED_DEMO_EMAIL;
  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (demoEmail && demoPassword) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SEED_DEMO_* interdit en production.');
    }
    await seedDemo(prisma, demoEmail, demoPassword);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
