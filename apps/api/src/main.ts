import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  configureApp(app);
  // L'API n'est joignable que par le serveur web, qui transmet l'IP du visiteur :
  // la limite de connexions (ThrottlerGuard) s'applique alors par visiteur.
  if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
  app.enableCors({ origin: process.env.WEB_URL, credentials: true });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
