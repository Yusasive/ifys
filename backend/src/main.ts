import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { bootstrapSuperAdminIfNeeded } from './bootstrap-admin';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  try {
    await bootstrapSuperAdminIfNeeded(app);
  } catch (err) {
    new Logger('Bootstrap').error(
      `bootstrapSuperAdminIfNeeded failed: ${String(err)}`,
    );
  }

  app.use(helmet());
  app.set('trust proxy', 1);
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',

    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);

  // The ALB keeps idle connections to the API open for 60s, but Node closes
  // them after 5s by default. When the ALB reuses one Node just closed, the
  // request fails with a 502 (and no CORS headers), so Node must hold idle
  // connections longer than the ALB does.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}
void bootstrap();
