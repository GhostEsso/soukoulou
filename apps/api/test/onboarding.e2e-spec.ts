import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.module';
import { LifecycleService } from '../src/schools/lifecycle.service';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF');
const HTML = Buffer.from('<html><script>alert(1)</script></html>');
const RUN = Date.now().toString(36); // la base de test n'est jamais vidée : données uniques par exécution
const EMAIL = `directrice-${RUN}@espoir.tg`;
const SLUG = `lycee-espoir-${RUN}`;

/** Parcours complet : inscription → découverte → upgrade → paiement → vérification → vacances. */
describe('Inscription et vérification des écoles (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let mail: MailService;
  let prisma: PrismaService;

  let owner: string; // jeton d'accès du responsable
  let admin: string; // jeton d'accès de l'admin Soukoulou
  let schoolId: string;
  let refreshToken: string;
  let docs: Record<string, string> = {}; // nom de la pièce → id

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const tokenFromLastMail = () =>
    /token=([\w-]+)/.exec(mail.outbox.at(-1)!.text)![1];
  const overview = async () =>
    (
      await http
        .get(`/schools/${schoolId}/onboarding`)
        .set(auth(owner))
        .expect(200)
    ).body;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
    mail = app.get(MailService);
    prisma = app.get(PrismaService);
  });

  afterAll(() => app.close());

  it('inscription libre, puis confirmation de l’email', async () => {
    await http
      .post('/public/schools/signup')
      .send({
        schoolName: 'Lycée Espoir',
        schoolType: 'HIGH',
        country: 'TG',
        city: 'Lomé',
      })
      .expect(400);

    await http
      .post('/public/schools/signup')
      .send({
        schoolName: 'Lycée Espoir',
        schoolType: 'HIGH',
        country: 'tg',
        city: 'Lomé',
        firstName: 'Ama',
        lastName: 'Mensah',
        phone: '+22890000000',
        email: EMAIL.toUpperCase(),
        password: 'motdepasse-solide',
      })
      .expect(201);

    await http
      .post('/auth/login')
      .send({ identifier: EMAIL, password: 'motdepasse-solide' })
      .expect(403);

    const res = await http
      .post('/auth/verify-email')
      .send({ token: tokenFromLastMail() })
      .expect(200);
    owner = res.body.accessToken;
    refreshToken = res.body.refreshToken;

    const me = await http.get('/auth/me').set(auth(owner)).expect(200);
    schoolId = me.body.memberships[0].school.id;
    expect(me.body.memberships[0].role).toBe('SCHOOL_ADMIN');
  });

  it('mode découverte : 15 jours, rien de réel', async () => {
    const o = await overview();
    expect(o.school.subscriptionStatus).toBe('DISCOVERY');
    expect(o.access.read).toBe('DISCOVERY');
    const days =
      (new Date(o.school.discoveryExpiresAt).getTime() - Date.now()) /
      86_400_000;
    expect(Math.round(days)).toBe(15);
    expect(o.requirements).toHaveLength(2);
    docs = Object.fromEntries(
      o.requirements.map((r: { name: string; id: string }) => [r.name, r.id]),
    );
  });

  it('refresh token : rotation, et réutilisation détectée', async () => {
    const res = await http
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    await http.post('/auth/refresh').send({ refreshToken }).expect(401);
    await http
      .post('/auth/refresh')
      .send({ refreshToken: res.body.refreshToken })
      .expect(401); // sessions coupées
  });

  it('upgrade : infos, pièces, puis paiement', async () => {
    await http
      .post(`/schools/${schoolId}/subscription/checkout`)
      .set(auth(owner))
      .send({
        planCode: 'STANDARD',
        billingCycle: 'SCHOOL_YEAR',
        method: 'MOBILE_MONEY',
      })
      .expect(400);

    await http
      .get('/public/schools/slug-availability?slug=admin')
      .expect(200, { slug: 'admin', available: false });

    await http
      .put(`/schools/${schoolId}/onboarding/info`)
      .set(auth(owner))
      .send({
        ownership: 'PRIVATE_SECULAR',
        address: 'Quartier Bè, Lomé',
        phone: '+22891111111',
        email: 'contact@espoir.tg',
        authorizationNumber: 'MEN-2019-042',
        approxStudentCount: 640,
        desiredSlug: SLUG,
      })
      .expect(200);

    const [authz, idCard] = Object.values(docs);
    await http
      .put(`/schools/${schoolId}/onboarding/documents/${authz}`)
      .set(auth(owner))
      .attach('file', HTML, {
        filename: 'piege.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    for (const id of [authz, idCard]) {
      await http
        .put(`/schools/${schoolId}/onboarding/documents/${id}`)
        .set(auth(owner))
        .attach('file', PDF, {
          filename: 'piece.pdf',
          contentType: 'application/pdf',
        })
        .expect(200);
    }

    const checkout = await http
      .post(`/schools/${schoolId}/subscription/checkout`)
      .set(auth(owner))
      .send({
        planCode: 'STANDARD',
        billingCycle: 'SCHOOL_YEAR',
        method: 'MOBILE_MONEY',
      })
      .expect(201);
    expect(checkout.body.amount).toBe(350_000); // 8 mois pour le prix de 7

    const body = JSON.stringify({
      providerRef: checkout.body.paymentId,
      status: 'PAID',
    });
    const sign = (b: string) =>
      createHmac('sha256', 'test-webhook-secret').update(b).digest('hex');
    await http
      .post('/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set('x-soukoulou-signature', 'deadbeef')
      .send(body)
      .expect(401);
    await http
      .post('/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set('x-soukoulou-signature', sign(body))
      .send(body)
      .expect(200);

    const o = await overview();
    expect(o.school.subscriptionStatus).toBe('ACTIVE');
    expect(o.school.slug).toBe(SLUG);
    expect(o.school.verificationStatus).toBe('PENDING');
    expect(o.access.write).toBeNull(); // configure sa vraie école
    expect(o.access.invite).toBe('NOT_VERIFIED'); // mais n'invite personne
    expect(o.access.collect).toBe('NOT_VERIFIED');
  });

  it('admin : alerte, pièces vérifiées une par une, compléments demandés', async () => {
    await http.get('/platform/alerts').set(auth(owner)).expect(403);

    const res = await http
      .post('/auth/login')
      .send({ identifier: 'admin@test.local', password: 'Admin-Test-123' })
      .expect(200);
    admin = res.body.accessToken;

    const alerts = await http
      .get('/platform/alerts?unread=true')
      .set(auth(admin))
      .expect(200);
    expect(alerts.body.items.map((a: { type: string }) => a.type)).toContain(
      'NEW_VERIFICATION',
    );

    const detail = await http
      .get(`/platform/verifications/${schoolId}`)
      .set(auth(admin))
      .expect(200);
    const [authzDoc, idDoc] = detail.body.requirements.map(
      (r: { document: { id: string } }) => r.document.id,
    );

    await http
      .post(`/platform/verifications/${schoolId}/approve`)
      .set(auth(admin))
      .expect(400);

    const review = (id: string, body: object) =>
      http
        .post(`/platform/verifications/${schoolId}/documents/${id}/review`)
        .set(auth(admin))
        .send(body);
    await review(authzDoc, { status: 'REJECTED' }).expect(400); // commentaire obligatoire
    await review(authzDoc, {
      status: 'REJECTED',
      comment: 'Document illisible',
    }).expect(200);
    await review(idDoc, { status: 'ACCEPTED' }).expect(200);

    await http
      .post(`/platform/verifications/${schoolId}/request-changes`)
      .set(auth(admin))
      .send({ message: 'Merci de renvoyer une autorisation lisible.' })
      .expect(200);
    expect(mail.outbox.at(-1)!.text).toContain('Document illisible');
  });

  it('l’école corrige la pièce refusée et renvoie', async () => {
    expect((await overview()).school.verificationStatus).toBe(
      'CHANGES_REQUESTED',
    );
    await http
      .post(`/schools/${schoolId}/onboarding/resubmit`)
      .set(auth(owner))
      .expect(400);

    const [authz, idCard] = Object.values(docs);
    await http
      .put(`/schools/${schoolId}/onboarding/documents/${idCard}`)
      .set(auth(owner))
      .attach('file', PDF, 'piece.pdf')
      .expect(409); // pièce déjà conforme
    await http
      .put(`/schools/${schoolId}/onboarding/documents/${authz}`)
      .set(auth(owner))
      .attach('file', PDF, 'autorisation.pdf')
      .expect(200);
    await http
      .post(`/schools/${schoolId}/onboarding/resubmit`)
      .set(auth(owner))
      .expect(200);
  });

  it('validation : l’école est ouverte à ses utilisateurs', async () => {
    const detail = await http
      .get(`/platform/verifications/${schoolId}`)
      .set(auth(admin))
      .expect(200);
    const pending = detail.body.requirements.find(
      (r: { document: { reviewStatus: string } }) =>
        r.document.reviewStatus === 'PENDING',
    );
    await http
      .post(
        `/platform/verifications/${schoolId}/documents/${pending.document.id}/review`,
      )
      .set(auth(admin))
      .send({ status: 'ACCEPTED' })
      .expect(200);
    await http
      .post(`/platform/verifications/${schoolId}/approve`)
      .set(auth(admin))
      .expect(200);

    const o = await overview();
    expect(o.school.verificationStatus).toBe('VERIFIED');
    expect(o.access.invite).toBeNull();
    expect(o.access.collect).toBeNull();

    // Couleur personnalisée : réservée à l'offre Premium (l'école est en Standard).
    await http
      .put(`/schools/${schoolId}/settings/theme`)
      .set(auth(owner))
      .send({ brandColor: '#0F766E' })
      .expect(403);

    const file = await http
      .get(`/schools/${schoolId}/documents/${pending.document.id}/file`)
      .set(auth(owner))
      .expect(200);
    expect(file.headers['content-type']).toBe('application/pdf');
  });

  it('vacances : lecture seule, puis suspension à la rentrée sans paiement', async () => {
    const lifecycle = app.get(LifecycleService);
    await prisma.school.update({
      where: { id: schoolId },
      data: { subscriptionEndsAt: new Date('2027-06-05') },
    });

    await lifecycle.runDaily(new Date('2027-06-15'));
    let o = await overview();
    expect(o.school.subscriptionStatus).toBe('READ_ONLY');
    expect(o.access.read).toBeNull();
    expect(o.access.write).toBe('READ_ONLY');

    await prisma.schoolCalendar.upsert({
      where: {
        country_schoolYearLabel: {
          country: 'TG',
          schoolYearLabel: '2027-2028',
        },
      },
      create: {
        country: 'TG',
        schoolYearLabel: '2027-2028',
        startsOn: new Date('2027-10-01'),
        endsOn: new Date('2028-05-31'),
      },
      update: {},
    });
    await lifecycle.runDaily(new Date('2027-10-01T12:00:00Z'));
    expect((await overview()).school.subscriptionStatus).toBe('READ_ONLY'); // 1 jour de grâce
    await lifecycle.runDaily(new Date('2027-10-03'));
    o = await overview();
    expect(o.school.subscriptionStatus).toBe('SUSPENDED');
  });
});
