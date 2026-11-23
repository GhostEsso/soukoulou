import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Configuration commune à l'application et aux tests. */
export function configureApp(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
