import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.module';
import { PrismaService } from '../src/prisma/prisma.module';
import { configureApp } from '../src/setup';

const RUN = Date.now().toString(36);
const PASSWORD = 'motdepasse-solide';

describe('Frais de scolarité : décaissements (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let mail: MailService;
  let ip = 0;
  let platform: { Authorization: string };

  const login = async (identifier: string, password: string) =>
    `Bearer ${
      (
        await http
          .post('/auth/login')
          .set('X-Client-Ip', `10.8.${++ip}.1`)
          .send({ identifier, password })
          .expect(200)
      ).body.accessToken as string
    }`;

  /** École active avec `online` FCFA encaissés en ligne (paiement inséré directement) et 5 000 en espèces. */
  async function setup(tag: string, online: number) {
    const plan = await prisma.plan.findUniqueOrThrow({
      where: { code: 'STANDARD' },
    });
    const school = await prisma.school.create({
      data: {
        name: `Ecole ${tag}`,
        type: 'HIGH',
        country: 'TG',
        city: 'Lomé',
        subscriptionStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        planId: plan.id,
        subscriptionEndsAt: new Date(Date.now() + 90 * 86_400_000),
      },
    });
    const email = `payout-${tag}-${RUN}@ecole.tg`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hash(PASSWORD),
        emailVerifiedAt: new Date(),
        firstName: 'Ama',
        lastName: 'Mensah',
      },
    });
    await prisma.membership.create({
      data: { userId: user.id, schoolId: school.id, role: 'SCHOOL_ADMIN' },
    });
    const year = await prisma.academicYear.create({
      data: {
        schoolId: school.id,
        label: '2026-2027',
        startsOn: new Date('2026-09-01'),
        endsOn: new Date('2027-07-01'),
        periodType: 'TRIMESTER',
        isCurrent: true,
      },
    });
    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        firstName: 'Kofi',
        lastName: 'Test',
        sex: 'MALE',
      },
    });
    const fee = await prisma.studentFee.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        yearId: year.id,
        label: 'Scolarité',
      },
    });
    const pay = (amount: number, method: 'MOBILE_MONEY' | 'CASH') =>
      prisma.feePayment.create({
        data: {
          schoolId: school.id,
          studentFeeId: fee.id,
          amount,
          method,
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    await pay(online, 'MOBILE_MONEY');
    await pay(5_000, 'CASH'); // l'espèces ne se décaisse pas
    return {
      schoolId: school.id,
      email,
      auth: { Authorization: await login(email, PASSWORD) },
    };
  }

  const ask = (
    schoolId: string,
    auth: Record<string, string>,
    amount: number,
    destination = '+22890000000',
  ) =>
    http
      .post(`/schools/${schoolId}/fees/payouts`)
      .set(auth)
      .send({ amount, destination });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    platform = {
      Authorization: await login('admin@test.local', 'Admin-Test-123'),
    };
  });

  afterAll(() => app.close());

  it('demande, plafond au disponible, simultanées, rejet libère, paiement', async () => {
    const { schoolId, email, auth } = await setup('flow', 10_000);

    const first = await ask(schoolId, auth, 6_000).expect(201);
    expect(first.body).toMatchObject({ status: 'REQUESTED', amount: 6_000 });
    const over = await ask(schoolId, auth, 4_001).expect(400);
    expect(over.body.message).toBe(
      'Montant supérieur au disponible (4 000 FCFA).',
    );

    // deux demandes simultanées de 4 000 : une seule passe (400 ou 409 pour l'autre)
    const both = await Promise.all([
      ask(schoolId, auth, 4_000),
      ask(schoolId, auth, 4_000),
    ]);
    const codes = both.map((r) => r.status).sort();
    expect(codes[0]).toBe(201);
    expect([400, 409]).toContain(codes[1]);

    const mine = await http
      .get(`/schools/${schoolId}/fees/payouts`)
      .set(auth)
      .expect(200);
    expect(mine.body).toHaveLength(2);
    expect(mine.body[0].amount).toBe(4_000); // plus récente d'abord

    // rejet de la 1re : 6 000 de nouveau disponibles
    await http
      .post(`/platform/payouts/${first.body.id}/reject`)
      .set(platform)
      .send({ reason: 'RIB illisible' })
      .expect(200);
    expect(mail.outbox.at(-1)).toMatchObject({
      to: email,
      subject: 'Décaissement refusé : 6 000 FCFA',
    });
    expect(mail.outbox.at(-1)!.text).toContain('RIB illisible');
    const again = await ask(schoolId, auth, 6_000).expect(201);

    // déjà traitée : 409 ; inconnue : 404
    await http
      .post(`/platform/payouts/${first.body.id}/paid`)
      .set(platform)
      .send({ providerRef: 'X1' })
      .expect(409);
    await http
      .post('/platform/payouts/inconnu/paid')
      .set(platform)
      .send({ providerRef: 'X1' })
      .expect(404);

    const paid = await http
      .post(`/platform/payouts/${again.body.id}/paid`)
      .set(platform)
      .send({ providerRef: 'MM-123' })
      .expect(200);
    expect(paid.body).toMatchObject({
      status: 'PAID',
      providerRef: 'MM-123',
      processedById: expect.any(String),
    });
    expect(mail.outbox.at(-1)!.subject).toBe(
      'Décaissement effectué : 6 000 FCFA',
    );

    const all = await http
      .get('/platform/payouts?status=PAID')
      .set(platform)
      .expect(200);
    expect(
      all.body.some(
        (p: { id: string; school: { name: string } }) =>
          p.id === again.body.id && p.school.name === 'Ecole flow',
      ),
    ).toBe(true);
  });

  it('validation et accès', async () => {
    const { schoolId, auth } = await setup('val', 10_000);
    await ask(schoolId, auth, 0).expect(400);
    await ask(schoolId, auth, 1_000, ' ab ').expect(400);
    await http
      .post(`/platform/payouts/x/paid`)
      .set(platform)
      .send({ providerRef: '' })
      .expect(400);
    await http
      .post(`/platform/payouts/x/reject`)
      .set(platform)
      .send({ reason: '' })
      .expect(400);
    // réservé à l'admin Soukoulou
    await http.get('/platform/payouts').set(auth).expect(403);
    await http
      .post('/platform/payouts/x/paid')
      .set(auth)
      .send({ providerRef: 'a' })
      .expect(403);
    // autre école : refusé
    const other = await setup('val2', 10_000);
    await ask(schoolId, other.auth, 1_000).expect(403);
    await http.get(`/schools/${schoolId}/fees/payouts`).expect(401);
  });
});
