import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.module';
import { MailService } from '../src/mail/mail.module';
import { LifecycleService } from '../src/schools/lifecycle.service';
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

  it('recalculer : seuls les dus sans paiement suivent la règle', async () => {
    const r = await http
      .post(`/schools/${schoolId}/fees/schedules`)
      .set(auth())
      .send(rule([lv['6e']], lines(10_000)))
      .expect(201);
    const free = await enroll('Libre', cl['6e']);
    const paid = await enroll('Paye', cl['6e']);
    const fee = await feeOf(paid);
    await prisma.feePayment.create({
      data: {
        schoolId,
        studentFeeId: fee!.id,
        amount: 1_000,
        method: 'CASH',
        status: 'FAILED',
      },
    });
    await http
      .patch(`/schools/${schoolId}/fees/schedules/${r.body.id}`)
      .set(auth())
      .send(rule([lv['6e']], lines(15_000)))
      .expect(200);
    expect(total(await feeOf(free))).toBe(10_000);
    const res = await http
      .post(`/schools/${schoolId}/fees/schedules/${r.body.id}/reapply`)
      .set(auth())
      .expect(200);
    expect(res.body.recomputed).toBeGreaterThanOrEqual(1);
    expect(total(await feeOf(free))).toBe(15_000);
    expect(total(await feeOf(paid))).toBe(10_000); // un paiement, même échoué : dû gardé
    await http
      .delete(`/schools/${schoolId}/fees/schedules/${r.body.id}`)
      .set(auth())
      .expect(204);
  });

  it('supprimer un élève ayant des paiements : 409 ; sans paiement : 204', async () => {
    const r = await http
      .post(`/schools/${schoolId}/fees/schedules`)
      .set(auth())
      .send(rule([lv['6e']], lines(10_000)))
      .expect(201);
    const sid = await enroll('Supp', cl['6e']);
    const fee = await feeOf(sid);
    await prisma.feePayment.create({
      data: {
        schoolId,
        studentFeeId: fee!.id,
        amount: 1_000,
        method: 'CASH',
        status: 'PAID',
        paidAt: new Date(),
      },
    });
    const res = await http
      .delete(`/schools/${schoolId}/students/${sid}`)
      .set(auth())
      .expect(409);
    expect(res.body.message).toBe(
      'Cet élève a des paiements enregistrés : il ne peut pas être supprimé.',
    );
    const free = await enroll('Supp2', cl['6e']);
    await http
      .delete(`/schools/${schoolId}/students/${free}`)
      .set(auth())
      .expect(204);
    await http
      .delete(`/schools/${schoolId}/fees/schedules/${r.body.id}`)
      .set(auth())
      .expect(204);
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

    it('un encaissement ne fait pas avancer School.updatedAt', async () => {
      const id = await enroll('Stable', cl['5e']);
      const before = await prisma.school.findUniqueOrThrow({
        where: { id: schoolId },
      });
      await http
        .post(`${base()}/payments`)
        .set(auth())
        .send({ studentId: id, amount: 1_000 })
        .expect(201);
      const after = await prisma.school.findUniqueOrThrow({
        where: { id: schoolId },
      });
      expect(after.receiptSeq).toBe(before.receiptSeq + 1);
      expect(after.updatedAt).toEqual(before.updatedAt);
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
  describe('relances', () => {
    const NOW = new Date('2026-10-01T08:00:00Z');
    const parentEmail = `parent-rel-${RUN}@famille.tg`;
    let rId: string;
    let rToken: string;
    let rYear: string;
    let rClass: string;

    const sent = () =>
      app
        .get(MailService)
        .outbox.filter((m) => m.to === parentEmail)
        .map((m) => m.subject);

    // Élève avec parent (email unique à l'exécution), une tranche de 30 000 échue à `dueOn`.
    async function studentDue(
      name: string,
      dueOn: string,
      paid = 0,
      createdAt: Date | null = new Date('2026-01-01'),
    ) {
      await http
        .post(`/schools/${rId}/fees/schedules`)
        .set({ Authorization: `Bearer ${rToken}` })
        .send({
          yearId: rYear,
          sex: null,
          levelIds: [
            (
              await prisma.classroom.findUniqueOrThrow({
                where: { id: rClass },
              })
            ).levelId,
          ],
          lines: [{ amount: 30_000, dueOn }],
        })
        .expect(201);
      const st = await http
        .post(`/schools/${rId}/students`)
        .set({ Authorization: `Bearer ${rToken}` })
        .send({
          firstName: name,
          lastName: 'Rel',
          sex: 'MALE',
          classroomId: rClass,
        })
        .expect(201);
      const parent = await prisma.parent.create({
        data: {
          schoolId: rId,
          firstName: 'Kofi',
          lastName: 'Rel',
          phone: `+228${Math.floor(Math.random() * 1e8)}`,
          email: parentEmail,
          children: { create: { studentId: st.body.id, relation: 'FATHER' } },
        },
      });
      expect(parent.id).toBeTruthy();
      if (createdAt)
        await prisma.studentFee.updateMany({
          where: { studentId: st.body.id },
          data: { createdAt },
        });
      if (paid) {
        const fee = await prisma.studentFee.findFirstOrThrow({
          where: { studentId: st.body.id },
        });
        await prisma.feePayment.create({
          data: {
            schoolId: rId,
            studentFeeId: fee.id,
            amount: paid,
            method: 'CASH',
            status: 'PAID',
            paidAt: NOW,
          },
        });
      }
    }

    beforeAll(async () => {
      const r = await makeSchool('rel', 'STANDARD');
      rId = r.school.id;
      rToken = r.token;
      rYear = r.year.id;
      const l = await prisma.level.create({
        data: { schoolId: rId, name: '6e', position: 0 },
      });
      rClass = (
        await prisma.classroom.create({
          data: { schoolId: rId, yearId: rYear, levelId: l.id, name: '6e A' },
        })
      ).id;
    });

    it('6 jours avant l’échéance : 1 email ; même jour relancé : aucun de plus', async () => {
      await studentDue('Pre', '2026-10-07');
      const lifecycle = app.get(LifecycleService);
      await lifecycle.runDaily(NOW);
      expect(sent()).toEqual([
        'Frais de scolarité : tranche n°1 à régler avant le 07/10/2026',
      ]);
      await lifecycle.runDaily(NOW);
      expect(sent()).toHaveLength(1);
    });

    it('dû créé aujourd’hui avec une tranche échue le mois dernier : aucun email', async () => {
      const before = sent().length;
      await prisma.feeSchedule.deleteMany({ where: { schoolId: rId } });
      await prisma.studentFee.deleteMany({ where: { schoolId: rId } });
      await studentDue('Recent', '2026-09-01', 0, null);
      await app.get(LifecycleService).runDaily(new Date());
      expect(sent()).toHaveLength(before);
    });

    it('tranche soldée : aucun email', async () => {
      const before = sent().length;
      await prisma.feeSchedule.deleteMany({ where: { schoolId: rId } });
      await studentDue('Solde', '2026-10-05', 30_000);
      await app.get(LifecycleService).runDaily(NOW);
      expect(sent()).toHaveLength(before);
    });
  });
});
