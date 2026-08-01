import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // M6: security headers on every response. Behind a reverse proxy in
  // production, `trust proxy` is required for req.ip (and therefore
  // per-client rate limiting) to reflect the real client, not the proxy.
  app.use(helmet());
  app.set('trust proxy', 1);

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
