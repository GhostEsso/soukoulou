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
});
