import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.module';
import { configureApp } from '../src/setup';

const RUN = Date.now().toString(36); // la base de test n'est jamais vidée : données uniques par exécution
const PASSWORD = 'motdepasse-solide';

describe('Frais de scolarité : grille et montants figés (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let token: string;
  let schoolId: string;
  let yearId: string;
  let lv: Record<string, string>;
  let cl: Record<string, string>;
  let scheduleId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const lines = (...a: number[]) =>
    a.map((amount, i) => ({ amount, dueOn: `2026-${10 + i}-15` }));
  const rule = (levelIds: string[], l = lines(20_000, 20_000)) => ({
    yearId,
    sex: null,
    levelIds,
    lines: l,
  });
  const enroll = async (name: string, classroomId: string) => {
    const r = await http
      .post(`/schools/${schoolId}/students`)
      .set(auth())
      .send({ firstName: name, lastName: 'Test', sex: 'MALE', classroomId })
      .expect(201);
    return r.body.id as string;
  };
  const feeOf = (studentId: string) =>
    prisma.studentFee.findUnique({
      where: { studentId_yearId: { studentId, yearId } },
      include: { lines: { orderBy: { position: 'asc' } } },
    });
  const total = (f: { lines: { amount: number }[] } | null) =>
    f?.lines.reduce((s, l) => s + l.amount, 0);

  async function makeSchool(tag: string, plan: 'STANDARD' | 'ESSENTIEL') {
    const p = await prisma.plan.findUniqueOrThrow({ where: { code: plan } });
    const email = `fees-${tag}-${RUN}@ecole.tg`;
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
    const res = await http
      .post('/auth/login')
      .send({ identifier: email, password: PASSWORD })
      .expect(200);
    return {
      school,
      year,
      token: res.body.accessToken as string,
    };
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);

    const s = await makeSchool('std', 'STANDARD');
    schoolId = s.school.id;
    yearId = s.year.id;
    token = s.token;
    lv = {};
    cl = {};
    for (const [i, name] of ['6e', '5e', '2nde'].entries()) {
      const l = await prisma.level.create({
        data: { schoolId, name, position: i },
      });
      lv[name] = l.id;
      const c = await prisma.classroom.create({
        data: { schoolId, yearId, levelId: l.id, name: `${name} A` },
      });
      cl[name] = c.id;
    }
  });

  afterAll(() => app.close());

  it('crée une règle 6e-5e (2 tranches) : un élève de 5e doit 40 000', async () => {
    const res = await http
      .post(`/schools/${schoolId}/fees/schedules`)
      .set(auth())
      .send(rule([lv['6e'], lv['5e']]))
      .expect(201);
    scheduleId = res.body.id;
    const list = await http
      .get(`/schools/${schoolId}/fees/schedules?yearId=${yearId}`)
      .set(auth())
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].lines).toHaveLength(2);

    const id = await enroll('Kofi', cl['5e']);
    const fee = await feeOf(id);
    expect(total(fee)).toBe(40_000);
    expect(fee!.lines.map((l) => l.position)).toEqual([1, 2]);
  });

  it('refuse une 2e règle « tous » sur la 5e', async () => {
    const res = await http
      .post(`/schools/${schoolId}/fees/schedules`)
      .set(auth())
      .send(rule([lv['5e']]))
      .expect(400);
    expect(res.body.message).toBe(
      'Le niveau 5e a déjà des frais pour ce public.',
    );
  });

  it('modifier la règle ne touche pas les montants figés', async () => {
    const before = await enroll('Ama', cl['6e']);
    await http
      .patch(`/schools/${schoolId}/fees/schedules/${scheduleId}`)
      .set(auth())
      .send(rule([lv['6e'], lv['5e']], lines(25_000, 25_000)))
      .expect(200);
    expect(total(await feeOf(before))).toBe(40_000);
    const after = await enroll('Yao', cl['5e']);
    expect(total(await feeOf(after))).toBe(50_000);
  });

  it('refuse de changer l’année d’une règle', async () => {
    const other = await prisma.academicYear.create({
      data: {
        schoolId,
        label: '2027-2028',
        startsOn: new Date('2027-09-01'),
        endsOn: new Date('2028-07-01'),
        periodType: 'TRIMESTER',
      },
    });
    const res = await http
      .patch(`/schools/${schoolId}/fees/schedules/${scheduleId}`)
      .set(auth())
      .send({ ...rule([lv['6e']]), yearId: other.id })
      .expect(400);
    expect(res.body.message).toBe("L'année d'une règle ne peut pas changer.");
  });

  it('un élève sans règle (2nde) n’a pas de dû', async () => {
    const id = await enroll('Edem', cl['2nde']);
    expect(await feeOf(id)).toBeNull();
  });

  it('une règle créée plus tard s’applique aux élèves déjà inscrits', async () => {
    const id = await enroll('Sena', cl['2nde']);
    await http
      .post(`/schools/${schoolId}/fees/schedules`)
      .set(auth())
      .send(rule([lv['2nde']], lines(30_000)))
      .expect(201);
    expect(total(await feeOf(id))).toBe(30_000);
  });

  it('supprime une règle : les montants figés restent', async () => {
    const id = await enroll('Mawu', cl['6e']);
    await http
      .delete(`/schools/${schoolId}/fees/schedules/${scheduleId}`)
      .set(auth())
      .expect(204);
    expect(total(await feeOf(id))).toBe(50_000);
  });

  it('offre Essentiel : une seule tranche', async () => {
    const e = await makeSchool('ess', 'ESSENTIEL');
    const l = await prisma.level.create({
      data: { schoolId: e.school.id, name: '6e', position: 0 },
    });
    const post = (body: object) =>
      http
        .post(`/schools/${e.school.id}/fees/schedules`)
        .set({ Authorization: `Bearer ${e.token}` })
        .send(body);
    const body = { yearId: e.year.id, sex: null, levelIds: [l.id] };
    const res = await post({ ...body, lines: lines(20_000, 20_000) }).expect(
      400,
    );
    expect(res.body.message).toBe('Plusieurs tranches : offre Standard.');
    await post({ ...body, lines: lines(40_000) }).expect(201);
  });
  describe('caisse, reçus, tableau de bord', () => {
    const YEAR = new Date().getUTCFullYear();
    const base = () => `/schools/${schoolId}/fees`;
    let studentId: string;
    let paymentId: string;

    it('encaisse 25 000 sur 40 000 : reçu n°1, reste 15 000 ; 2e encaissement : n°2', async () => {
      await http
        .post(`${base()}/schedules`)
        .set(auth())
        .send(
          rule(
            [lv['6e'], lv['5e']],
            [
              { amount: 25_000, dueOn: '2020-01-15' },
              { amount: 15_000, dueOn: '2020-02-15' },
            ],
          ),
        )
        .expect(201);
      studentId = await enroll('Caisse', cl['5e']);
      const res = await http
        .post(`${base()}/payments`)
        .set(auth())
        .send({ studentId, amount: 25_000 })
        .expect(201);
      paymentId = res.body.id;
      expect(res.body.receiptNumber).toBe(`REC-${YEAR}-000001`);
      expect(res.body.method).toBe('CASH');
      expect(res.body.status).toBe('PAID');

      const detail = await http
        .get(`${base()}/students/${studentId}`)
        .set(auth())
        .expect(200);
      expect(
        detail.body.lines.map((l: { remaining: number }) => l.remaining),
      ).toEqual([0, 15_000]);
      expect(detail.body.payments).toHaveLength(1);

      const other = await enroll('Autre', cl['6e']);
      const r2 = await http
        .post(`${base()}/payments`)
        .set(auth())
        .send({ studentId: other, amount: 1_000 })
        .expect(201);
      expect(r2.body.receiptNumber).toBe(`REC-${YEAR}-000002`);
    });

    it('refuse un encaissement supérieur au reste à payer', async () => {
      const res = await http
        .post(`${base()}/payments`)
        .set(auth())
        .send({ studentId, amount: 20_000 })
        .expect(400);
      expect(res.body.message).toBe(
        'Le montant dépasse le reste à payer (15 000 FCFA).',
      );
    });

    it('deux encaissements simultanés ne dépassent jamais le dû', async () => {
      const id = await enroll('Course', cl['5e']);
      const res = await Promise.all(
        [0, 1].map(() =>
          http
            .post(`${base()}/payments`)
            .set(auth())
            .send({ studentId: id, amount: 30_000 }),
        ),
      );
      expect(res.map((r) => r.status).sort()).toEqual([201, 400]);
    });

    it('liste les soldes ; status=overdue contient l’élève', async () => {
      const all = await http
        .get(`${base()}/students?yearId=${yearId}`)
        .set(auth())
        .expect(200);
      const me = all.body.find(
        (b: { studentId: string }) => b.studentId === studentId,
      );
      expect(me).toMatchObject({
        due: 40_000,
        paid: 25_000,
        remaining: 15_000,
        overdue: true,
      });
      const od = await http
        .get(`${base()}/students?status=overdue`)
        .set(auth())
        .expect(200);
      expect(
        od.body.some((b: { studentId: string }) => b.studentId === studentId),
      ).toBe(true);
      const paid = await http
        .get(`${base()}/students?status=paid`)
        .set(auth())
        .expect(200);
      expect(
        paid.body.some((b: { studentId: string }) => b.studentId === studentId),
      ).toBe(false);
    });

    it('reçu : données complètes', async () => {
      const res = await http
        .get(`${base()}/payments/${paymentId}/receipt`)
        .set(auth())
        .expect(200);
      expect(res.body).toMatchObject({
        number: `REC-${YEAR}-000001`,
        amount: 25_000,
        remaining: 15_000,
        school: { name: 'Ecole std' },
        student: { name: 'Caisse TEST' },
        classroom: '5e A',
      });
    });

    it('tableau de bord : totaux et en ligne', async () => {
      const res = await http
        .get(`${base()}/dashboard?yearId=${yearId}`)
        .set(auth())
        .expect(200);
      expect(res.body.collected).toBeGreaterThanOrEqual(26_000);
      expect(res.body.due).toBeGreaterThan(res.body.collected);
      const b = res.body as {
        due: number;
        collected: number;
        remaining: number;
      };
      expect(b.remaining).toBe(b.due - b.collected);
      expect(res.body.online).toEqual({ collected: 0, available: 0 });
      expect(Array.isArray(res.body.byClassroom)).toBe(true);
    });

    it('tableau de bord en Essentiel : 403 PLAN', async () => {
      const e = await makeSchool('ess2', 'ESSENTIEL');
      const res = await http
        .get(`/schools/${e.school.id}/fees/dashboard`)
        .set({ Authorization: `Bearer ${e.token}` })
        .expect(403);
      expect(JSON.stringify(res.body)).toContain('PLAN');
    });

    it('reçu d’une autre école : 404', async () => {
      const o = await makeSchool('oth', 'STANDARD');
      await http
        .get(`/schools/${o.school.id}/fees/payments/${paymentId}/receipt`)
        .set({ Authorization: `Bearer ${o.token}` })
        .expect(404);
    });
  });
});
