import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, static as expressStatic } from 'express';
import { AppModule } from './app.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { AuthUserMiddleware } from './common/middleware/auth-user.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const PORT = Number(config.get('PORT') || 3000);
  const BODY_LIMIT = config.get('BODY_LIMIT') || '1mb';
  const CORS_ORIGIN = config.get('CORS_ORIGIN') || '*';
  const MODEL = config.get('OPENAI_MODEL') || 'gpt-5-mini';

  // Configurar OpenAPI/Swagger ANTES de global prefix
  const config_swagger = new DocumentBuilder()
    .setTitle('AICFES Item Generator API')
    .setDescription(
      'API para generar ítems de examen tipo ICFES usando inteligencia artificial. ' +
      'Soporta generación para múltiples áreas (MAT, LC, CN, SOC, ING) con validación estricta y trazabilidad.',
    )
    .setVersion('1.0.0')
    .addTag('Health', 'Estado del servidor')
    .addTag('Items', 'Generación y gestión de ítems de examen')
    .addTag('Dashboard', 'Dashboard, sesiones de estudio y misiones')
    .addTag('Auth', 'Registro y login básico')
    .addTag('TimeTrial', 'Modo contrarreloj')
    .addTag('Feedback', 'Retroalimentación IA personalizada')
    .addTag('Debug', 'Endpoints auxiliares para debugging/admin')
    .setContact(
      'AICFES Support',
      'https://github.com',
      'support@aicfes.example.com',
    )
    .setLicense('MIT', 'https://github.com/license')
    .build();

  app.setGlobalPrefix('api', {
    exclude: ['docs', 'docs-json'],
  });

  const document = SwaggerModule.createDocument(app, config_swagger);
  SwaggerModule.setup('docs', app, document);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'https:', 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          scriptSrc: [
            "'self'",
            'https://cdn.jsdelivr.net',
            "'unsafe-inline'",
            "'unsafe-eval'",
          ],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(json({ limit: BODY_LIMIT }));
  const corsOrigins = CORS_ORIGIN.split(',').map((origin) => origin.trim());
  const allowAllOrigins = corsOrigins.includes('*');

  app.enableCors({
    origin: allowAllOrigins
      ? true
      : (origin, callback) => {
          if (!origin || corsOrigins.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(null, false);
        },
    credentials: true,
  });

  // Servir archivos estáticos ANTES del request middleware y prefix global
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(expressStatic(publicPath));
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/api/docs', (_req, res) => res.redirect('/docs'));
  expressApp.get('/api/docs-json', (_req, res) => res.redirect('/docs-json'));

  app.use(AuthUserMiddleware);
  app.use(RequestIdMiddleware);
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(PORT);
  console.log(`\n🚀 Server running on port ${PORT} (model=${MODEL})`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
  console.log(`🖥️  UI: http://localhost:${PORT}\n`);
}

bootstrap();
