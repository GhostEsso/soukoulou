import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.module';
import { configureApp } from '../src/setup';

const RUN = Date.now().toString(36);
const PASSWORD = 'motdepasse-solide';

describe('Frais de scolarité : paiement en ligne des parents (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;

  let ip = 0;
  const sign = (body: string) =>
    createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
  const webhook = (
    providerRef: string,
    status: 'PAID' | 'FAILED',
    signature?: string,
  ) => {
    const body = JSON.stringify({ providerRef, status });
    return http
      .post('/webhooks/fee-payments')
      .set('Content-Type', 'application/json')
      .set('x-soukoulou-signature', signature ?? sign(body))
      .send(body);
  };

  /** École + grille 25 000 + 15 000, un élève et son parent connecté. */
  async function setup(tag: string, plan: 'STANDARD' | 'ESSENTIEL') {
    const p = await prisma.plan.findUniqueOrThrow({ where: { code: plan } });
    const school = await prisma.school.create({
      data: {
        name: `Ecole ${tag}`,
        type: 'HIGH',
        country: 'TG',
        city: 'Lomé',
        subscriptionStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        planId: p.id,
        subscriptionEndsAt: new Date(Date.now() + 90 * 86_400_000),
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: `online-${tag}-${RUN}@ecole.tg`,
        passwordHash: await hash(PASSWORD),
        emailVerifiedAt: new Date(),
        firstName: 'Ama',
        lastName: 'Mensah',
      },
    });
    await prisma.membership.create({
      data: { userId: admin.id, schoolId: school.id, role: 'SCHOOL_ADMIN' },
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
    const level = await prisma.level.create({
      data: { schoolId: school.id, name: '6e', position: 0 },
    });
    const classroom = await prisma.classroom.create({
      data: {
        schoolId: school.id,
        yearId: year.id,
        levelId: level.id,
        name: '6e A',
      },
    });
    const login = async (identifier: string, password: string) =>
      (
        await http
          .post('/auth/login')
          .set('X-Client-Ip', `10.9.${++ip}.1`) // limite de connexions par visiteur
          .send({ identifier, password })
          .expect(200)
      ).body.accessToken as string;
    const adminAuth = {
      Authorization: `Bearer ${await login(admin.email!, PASSWORD)}`,
    };
    const lines =
      plan === 'STANDARD'
        ? [
            { amount: 25_000, dueOn: '2026-10-15' },
            { amount: 15_000, dueOn: '2026-11-15' },
          ]
        : [{ amount: 40_000, dueOn: '2026-10-15' }];
    await http
      .post(`/schools/${school.id}/fees/schedules`)
      .set(adminAuth)
      .send({ yearId: year.id, sex: null, levelIds: [level.id], lines })
      .expect(201);

    const family = async (name: string) => {
      const s = await http
        .post(`/schools/${school.id}/students`)
        .set(adminAuth)
        .send({
          firstName: name,
          lastName: 'Test',
          sex: 'MALE',
          classroomId: classroom.id,
        })
        .expect(201);
      const par = await http
        .post(`/schools/${school.id}/parents`)
        .set(adminAuth)
        .send({
          firstName: `Parent${name}`,
          lastName: 'Test',
          phone: `+2289${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
          children: [{ studentId: s.body.id, relation: 'MOTHER' }],
        })
        .expect(201);
      const acc = await http
        .post(`/schools/${school.id}/parents/${par.body.id}/access`)
        .set(adminAuth)
        .expect(201);
      const token = await login(acc.body.phone, acc.body.code);
      return {
        studentId: s.body.id as string,
        parentId: par.body.id as string,
        auth: { Authorization: `Bearer ${token}` },
      };
    };
    return { schoolId: school.id, yearId: year.id, family };
  }

  const checkout = (
    schoolId: string,
    studentId: string,
    auth: Record<string, string>,
    amount: number,
  ) =>
    http
      .post(`/schools/${schoolId}/parent/children/${studentId}/fees/checkout`)
      .set(auth)
      .send({ amount });
  const view = async (
    schoolId: string,
    studentId: string,
    auth: Record<string, string>,
  ) => {
    const res = await http
      .get(`/schools/${schoolId}/parent/children/${studentId}`)
      .set(auth)
      .expect(200);
    const f = res.body.fees as {
      lines: { remaining: number }[];
      payments: { receiptNumber: string }[];
    };
    return {
      remaining: f.lines.reduce((s, l) => s + l.remaining, 0),
      payments: f.payments,
    };
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
  });

  afterAll(() => app.close());

  it('checkout 10 000 : PENDING sans effet sur le solde ; webhook PAID : reste 30 000, reçu ; rejeu : inchangé', async () => {
    const { schoolId, family } = await setup('std', 'STANDARD');
    const f = await family('Kofi');
    expect((await view(schoolId, f.studentId, f.auth)).remaining).toBe(40_000);

    const res = await checkout(schoolId, f.studentId, f.auth, 10_000).expect(
      201,
    );
    expect(res.body.checkoutUrl).toBeNull();
    expect(res.body.providerRef).toBe(res.body.paymentId);
    const row = await prisma.feePayment.findUniqueOrThrow({
      where: { id: res.body.paymentId },
    });
    expect(row).toMatchObject({
      status: 'PENDING',
      method: 'MOBILE_MONEY',
      amount: 10_000,
      parentId: f.parentId,
      receiptNumber: null,
    });
    expect((await view(schoolId, f.studentId, f.auth)).remaining).toBe(40_000);

    const ref = res.body.providerRef as string;
    const ok = await webhook(ref, 'PAID').expect(200);
    expect(ok.body.status).toBe('PAID');
    const after = await view(schoolId, f.studentId, f.auth);
    expect(after.remaining).toBe(30_000);
    expect(after.payments).toHaveLength(1);
    const receipt = after.payments[0].receiptNumber;
    expect(receipt).toMatch(/^REC-\d{4}-\d{6}$/);

    await webhook(ref, 'PAID').expect(200);
    const replay = await view(schoolId, f.studentId, f.auth);
    expect(replay.remaining).toBe(30_000);
    expect(replay.payments).toHaveLength(1);
    expect(replay.payments[0].receiptNumber).toBe(receipt);
    // le compteur de reçus n'a pas avancé au rejeu
    const school = await prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
    });
    expect(school.receiptSeq).toBe(1);
  });

  it('canPay vrai hors production ; en production sans prestataire : canPay faux et checkout 503', async () => {
    const { schoolId, family } = await setup('prov', 'STANDARD');
    const f = await family('Edem');
    const canPay = async () =>
      (
        await http
          .get(`/schools/${schoolId}/parent/children/${f.studentId}`)
          .set(f.auth)
          .expect(200)
      ).body.fees.canPay;
    expect(await canPay()).toBe(true);
    const env = process.env.NODE_ENV;
    const prov = process.env.PAYMENT_PROVIDER;
    process.env.NODE_ENV = 'production';
    delete process.env.PAYMENT_PROVIDER;
    try {
      expect(await canPay()).toBe(false);
      const res = await checkout(schoolId, f.studentId, f.auth, 1_000).expect(
        503,
      );
      expect(res.body.message).toBe(
        "Le paiement en ligne n'est pas encore disponible.",
      );
      expect(await prisma.feePayment.count({ where: { schoolId } })).toBe(0);
      process.env.PAYMENT_PROVIDER = 'x';
      expect(await canPay()).toBe(true);
    } finally {
      process.env.NODE_ENV = env;
      if (prov === undefined) delete process.env.PAYMENT_PROVIDER;
      else process.env.PAYMENT_PROVIDER = prov;
    }
  });

  it('webhook : mauvaise signature 401, référence inconnue 404, FAILED sans effet sur le solde', async () => {
    const { schoolId, family } = await setup('web', 'STANDARD');
    const f = await family('Yao');
    const c = await checkout(schoolId, f.studentId, f.auth, 5_000).expect(201);
    await webhook(c.body.providerRef, 'PAID', 'deadbeef').expect(401);
    await webhook(c.body.providerRef, 'PAID', sign('autre corps')).expect(401);
    expect(
      (
        await prisma.feePayment.findUniqueOrThrow({
          where: { id: c.body.paymentId },
        })
      ).status,
    ).toBe('PENDING');
    await webhook('inconnue', 'PAID').expect(404);

    await webhook(c.body.providerRef, 'FAILED').expect(200);
    // un FAILED n'est pas réversible par un PAID tardif rejoué : l'argent n'a pas été reçu
    await webhook(c.body.providerRef, 'PAID').expect(200);
    const row = await prisma.feePayment.findUniqueOrThrow({
      where: { id: c.body.paymentId },
    });
    expect(row.status).toBe('FAILED');
    expect((await view(schoolId, f.studentId, f.auth)).remaining).toBe(40_000);
  });

  it('refuse un montant supérieur au reste à payer', async () => {
    const { schoolId, family } = await setup('max', 'STANDARD');
    const f = await family('Ayi');
    const res = await checkout(schoolId, f.studentId, f.auth, 40_001).expect(
      400,
    );
    expect(res.body.message).toBe(
      'Le montant dépasse le reste à payer (40 000 FCFA).',
    );
    await checkout(schoolId, f.studentId, f.auth, 0).expect(400);
  });

  it('parent d’un autre élève : 404', async () => {
    const { schoolId, family } = await setup('oth', 'STANDARD');
    const a = await family('Edem');
    const b = await family('Sika');
    await checkout(schoolId, b.studentId, a.auth, 1_000).expect(404);
    expect(
      await prisma.feePayment.count({
        where: { studentFee: { studentId: b.studentId } },
      }),
    ).toBe(0);
  });

  it('école sans fee_payments (Essentiel) : 403 PLAN', async () => {
    const { schoolId, family } = await setup('ess', 'ESSENTIEL');
    const f = await family('Mawu');
    const res = await checkout(schoolId, f.studentId, f.auth, 1_000).expect(
      403,
    );
    expect(JSON.stringify(res.body)).toContain('PLAN');
  });

  it('frais seulement dans une autre année que l’année courante : 404', async () => {
    const { schoolId, yearId, family } = await setup('yr', 'STANDARD');
    const f = await family('Kodjo');
    await prisma.academicYear.update({
      where: { id: yearId },
      data: { isCurrent: false },
    });
    await prisma.academicYear.create({
      data: {
        schoolId,
        label: '2027-2028',
        startsOn: new Date('2027-09-01'),
        endsOn: new Date('2028-07-01'),
        periodType: 'TRIMESTER',
        isCurrent: true,
      },
    });
    await checkout(schoolId, f.studentId, f.auth, 1_000).expect(404);
    expect(
      await prisma.feePayment.count({
        where: { studentFee: { studentId: f.studentId } },
      }),
    ).toBe(0);
  });

  it('élève d’une autre école avec l’école du parent dans l’URL : 404', async () => {
    const a = await setup('xa', 'STANDARD');
    const b = await setup('xb', 'STANDARD');
    const pa = await a.family('Ewe');
    const sb = await b.family('Mina');
    await checkout(a.schoolId, sb.studentId, pa.auth, 1_000).expect(404);
    expect(
      await prisma.feePayment.count({
        where: { studentFee: { studentId: sb.studentId } },
      }),
    ).toBe(0);
  });
});
