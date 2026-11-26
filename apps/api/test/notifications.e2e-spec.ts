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

interface Item {
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
}

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let prisma: PrismaService;
  let ip = 0;

  let schoolId: string;
  let classroomId: string;
  let levelId: string;
  let yearId: string;
  let admin: Record<string, string>;
  let kofi: { studentId: string; auth: Record<string, string> };
  let ama: { studentId: string; auth: Record<string, string> };

  const saspayEnv = [
    'SASPAY_API_KEY',
    'SASPAY_API_URL',
    'SASPAY_WEBHOOK_SECRET',
  ];
  const savedEnv = saspayEnv.map((k) => [k, process.env[k]] as const);

  const login = async (identifier: string, password: string) => ({
    Authorization: `Bearer ${
      (
        await http
          .post('/auth/login')
          .set('X-Client-Ip', `10.8.${++ip}.1`)
          .send({ identifier, password })
          .expect(200)
      ).body.accessToken
    }`,
  });
  const inbox = async (auth: Record<string, string>) =>
    (await http.get(`/schools/${schoolId}/notifications`).set(auth).expect(200))
      .body as { items: Item[]; unread: number };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);
    for (const k of saspayEnv) delete process.env[k];

    const plan = await prisma.plan.findUniqueOrThrow({
      where: { code: 'STANDARD' },
    });
    const school = await prisma.school.create({
      data: {
        name: `Ecole notif ${RUN}`,
        type: 'HIGH',
        country: 'TG',
        city: 'Lomé',
        subscriptionStatus: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        planId: plan.id,
        subscriptionEndsAt: new Date(Date.now() + 90 * 86_400_000),
      },
    });
    schoolId = school.id;
    const user = await prisma.user.create({
      data: {
        email: `notif-${RUN}@ecole.tg`,
        passwordHash: await hash(PASSWORD),
        emailVerifiedAt: new Date(),
        firstName: 'Ama',
        lastName: 'Mensah',
      },
    });
    await prisma.membership.create({
      data: { userId: user.id, schoolId, role: 'SCHOOL_ADMIN' },
    });
    const year = await prisma.academicYear.create({
      data: {
        schoolId,
        label: '2026-2027',
        startsOn: new Date('2026-09-01'),
        endsOn: new Date('2027-07-01'),
        periodType: 'TRIMESTER',
        isCurrent: true,
      },
    });
    yearId = year.id;
    const level = await prisma.level.create({
      data: { schoolId, name: '6e', position: 0 },
    });
    levelId = level.id;
    classroomId = (
      await prisma.classroom.create({
        data: { schoolId, yearId: year.id, levelId: level.id, name: '6e A' },
      })
    ).id;
    admin = await login(user.email!, PASSWORD);
    await http
      .post(`/schools/${schoolId}/fees/schedules`)
      .set(admin)
      .send({
        yearId: year.id,
        sex: null,
        levelIds: [level.id],
        lines: [{ amount: 40_000, dueOn: '2026-10-15' }],
      })
      .expect(201);

    const family = async (name: string) => {
      const s = await http
        .post(`/schools/${schoolId}/students`)
        .set(admin)
        .send({ firstName: name, lastName: 'Notif', sex: 'MALE', classroomId })
        .expect(201);
      const par = await http
        .post(`/schools/${schoolId}/parents`)
        .set(admin)
        .send({
          firstName: `Parent${name}`,
          lastName: 'Notif',
          phone: `+2289${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
          children: [{ studentId: s.body.id, relation: 'MOTHER' }],
        })
        .expect(201);
      const acc = await http
        .post(`/schools/${schoolId}/parents/${par.body.id}/access`)
        .set(admin)
        .expect(201);
      return {
        studentId: s.body.id as string,
        auth: await login(acc.body.phone, acc.body.code),
      };
    };
    kofi = await family('Kofi');
    ama = await family('Ama');
  });

  afterAll(async () => {
    await app.close();
    for (const [k, v] of savedEnv) if (v !== undefined) process.env[k] = v;
  });

  it('encaissement en espèces : la famille est prévenue (reçu, reste) ; pas l’école', async () => {
    await http
      .post(`/schools/${schoolId}/fees/payments`)
      .set(admin)
      .send({ studentId: kofi.studentId, amount: 10_000 })
      .expect(201);
    const { items, unread } = await inbox(kofi.auth);
    expect(unread).toBe(1);
    expect(items[0]).toMatchObject({
      kind: 'PAYMENT',
      title: 'Paiement reçu : 10 000 FCFA',
      href: `/parent/${schoolId}/enfants/${kofi.studentId}`,
    });
    expect(items[0].body).toContain('reste à payer 30 000 FCFA');
    expect((await inbox(ama.auth)).items).toEqual([]);
    expect((await inbox(admin)).items).toEqual([]);
  });

  it('paiement en ligne confirmé : famille et administration', async () => {
    const res = await http
      .post(
        `/schools/${schoolId}/parent/children/${kofi.studentId}/fees/checkout`,
      )
      .set(kofi.auth)
      .send({ amount: 5_000 })
      .expect(201);
    const body = JSON.stringify({
      providerRef: res.body.providerRef,
      status: 'PAID',
    });
    const signature = createHmac('sha256', 'test-webhook-secret')
      .update(body)
      .digest('hex');
    for (let i = 0; i < 2; i++)
      // rejeu : une seule notification
      await http
        .post('/webhooks/fee-payments')
        .set('Content-Type', 'application/json')
        .set('x-soukoulou-signature', signature)
        .send(body)
        .expect(200);
    const school = (await inbox(admin)).items;
    expect(school).toHaveLength(1);
    expect(school[0]).toMatchObject({
      kind: 'PAYMENT',
      title: 'Paiement en ligne : 5 000 FCFA',
      href: `/ecole/${schoolId}/frais/tableau-de-bord`,
    });
    expect(
      (await inbox(kofi.auth)).items.filter((n) => n.kind === 'PAYMENT'),
    ).toHaveLength(2);
  });

  it('annonce aux parents : chaque parent, avec un lien vers ses annonces', async () => {
    await http
      .post(`/schools/${schoolId}/announcements`)
      .set(admin)
      .send({ title: 'Réunion', body: 'Samedi 9 h.', audiences: ['PARENT'] })
      .expect(201);
    for (const f of [kofi, ama])
      expect((await inbox(f.auth)).items[0]).toMatchObject({
        kind: 'ANNOUNCEMENT',
        title: 'Annonce : Réunion',
        href: `/parent/${schoolId}/annonces`,
      });
    expect(
      (await inbox(admin)).items.some((n) => n.kind === 'ANNOUNCEMENT'),
    ).toBe(false);
  });

  it('absence : une notification, pas de doublon si l’appel est réenregistré', async () => {
    const roll = (status: 'ABSENT' | 'PRESENT') =>
      http
        .put(`/schools/${schoolId}/attendance`)
        .set(admin)
        .send({
          classroomId,
          day: '2026-11-23',
          items: [
            { studentId: kofi.studentId, status },
            { studentId: ama.studentId, status: 'PRESENT' },
          ],
        })
        .expect(200);
    await roll('ABSENT');
    await roll('ABSENT');
    const absences = (await inbox(kofi.auth)).items.filter(
      (n) => n.kind === 'ATTENDANCE',
    );
    expect(absences).toHaveLength(1);
    expect(absences[0].title).toBe('Absence : Kofi');
    expect(
      (await inbox(ama.auth)).items.some((n) => n.kind === 'ATTENDANCE'),
    ).toBe(false);
  });

  it('sanction : la famille ; tout marquer comme lu', async () => {
    await http
      .post(`/schools/${schoolId}/discipline`)
      .set(admin)
      .send({
        studentId: kofi.studentId,
        kind: 'PUNISHMENT',
        reason: 'Bavardages répétés',
        day: '2026-11-23',
      })
      .expect(201);
    const before = await inbox(kofi.auth);
    expect(before.items[0]).toMatchObject({
      kind: 'DISCIPLINE',
      title: 'Punition : Kofi',
      body: 'Bavardages répétés',
    });
    expect(before.unread).toBeGreaterThan(0);
    await http
      .post(`/schools/${schoolId}/notifications/read`)
      .set(kofi.auth)
      .expect(204);
    expect((await inbox(kofi.auth)).unread).toBe(0);
    expect((await inbox(ama.auth)).unread).toBeGreaterThan(0);
  });

  it('notes : la famille de chaque élève noté ; rien si la note ne change pas', async () => {
    const subject = await prisma.subject.create({
      data: { schoolId, name: 'Mathématiques' },
    });
    await prisma.levelSubject.create({
      data: { levelId, subjectId: subject.id, coefficient: 4 },
    });
    const period = await prisma.period.create({
      data: {
        yearId,
        name: '1er trimestre',
        position: 0,
        startsOn: new Date('2026-09-01'),
        endsOn: new Date('2026-12-20'),
      },
    });
    const a = await http
      .post(`/schools/${schoolId}/assessments`)
      .set(admin)
      .send({
        classroomId,
        subjectId: subject.id,
        title: 'Devoir 1',
        day: '2026-11-20',
        maxScore: 20,
      })
      .expect(201);
    const grade = (score: number | null) =>
      http
        .put(`/schools/${schoolId}/assessments/${a.body.id}/grades`)
        .set(admin)
        .send({
          items: [
            { studentId: kofi.studentId, score: 14.5 },
            { studentId: ama.studentId, score },
          ],
        })
        .expect(200);
    await grade(null);
    await grade(null); // rien ne change : pas de doublon
    await grade(12);
    const kofiGrades = (await inbox(kofi.auth)).items.filter(
      (n) => n.kind === 'GRADE',
    );
    expect(kofiGrades).toHaveLength(1);
    expect(kofiGrades[0]).toMatchObject({
      title: 'Note : Kofi — 14.5/20',
      body: 'Mathématiques · Devoir 1',
      href: `/parent/${schoolId}/enfants/${kofi.studentId}`,
    });
    expect(
      (await inbox(ama.auth)).items.filter((n) => n.kind === 'GRADE'),
    ).toHaveLength(1);

    // Bulletin : premier avis du conseil sur la période, pas quand on le corrige.
    const council = (comment: string) =>
      http
        .put(`/schools/${schoolId}/assessments/council`)
        .set(admin)
        .send({
          classroomId,
          scope: period.id,
          items: [{ studentId: kofi.studentId, comment }],
        })
        .expect(204);
    await council('Bon trimestre.');
    await council('Bon trimestre, continuez.');
    const cards = (await inbox(kofi.auth)).items.filter(
      (n) => n.kind === 'REPORT_CARD',
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe('Bulletin : Kofi (1er trimestre)');
    expect(
      (await inbox(ama.auth)).items.some((n) => n.kind === 'REPORT_CARD'),
    ).toBe(false);
  });
});
