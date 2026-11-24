import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

const SECRET = 'test-api-secret-0123456789';
const RUN = Date.now().toString(36);

/** API publique (hébergement séparé) : seul le web, qui connaît API_SECRET, peut l'appeler. */
describe('API publique protégée par API_SECRET (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  const login = (ip: string, secret = SECRET) =>
    http
      .post('/auth/login')
      .set('X-Api-Secret', secret)
      .set('X-Client-Ip', ip)
      .send({
        identifier: `personne-${RUN}@test.local`,
        password: 'mauvais-mdp',
      });

  beforeAll(async () => {
    process.env.API_SECRET = SECRET;
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    delete process.env.API_SECRET;
    await app.close();
  });

  it('sans le secret : refusé, sauf la sonde /health', async () => {
    await http.get('/health').expect(200);
    await http.get('/auth/me').expect(403);
    await http.get('/auth/me').set('X-Api-Secret', 'faux').expect(403);
    await http.get('/auth/me').set('X-Api-Secret', SECRET).expect(401); // passe au contrôle du jeton
  });

  it('webhooks du prestataire : exemptés du secret, protégés par leur signature (401, pas 403)', async () => {
    for (const path of ['/webhooks/fee-payments', '/webhooks/payments'])
      await http
        .post(path)
        .set('x-soukoulou-signature', 'deadbeef')
        .send({ providerRef: 'x', status: 'PAID' })
        .expect(401);
  });

  it('tâche quotidienne déclenchable avec le secret seulement', async () => {
    await http.post('/internal/daily').expect(403);
    await http.post('/internal/daily').set('X-Api-Secret', SECRET).expect(204);
  });

  it('limite de connexions par visiteur (X-Client-Ip transmis par le web)', async () => {
    const a = `10.0.${RUN.length}.1`;
    for (let i = 0; i < 10; i++) await login(a).expect(401);
    await login(a).expect(429);
    await login(`10.0.${RUN.length}.2`).expect(401); // un autre visiteur n'est pas bloqué
  });
});
