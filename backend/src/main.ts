import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

// 🔧 BigInt → string (evita crash em JSON)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

// 🛡️ Disponibilidade: erros de FUNDO (ex.: retry do Kafka, socket) não podem
// derrubar a API. São logados; o Outbox garante a entrega dos eventos ao menos
// uma vez. Erros de request seguem tratados pelo AllExceptionsFilter.
process.on('unhandledRejection', (reason) => {
  console.error(
    JSON.stringify({
      level: 'ERROR',
      logger: 'process',
      message: 'unhandledRejection',
      reason: reason instanceof Error ? reason.message : String(reason),
    }),
  );
});

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  // Atrás de proxy/ingress (TLS terminado lá): confia no X-Forwarded-* para
  // que req.secure/proto reflitam o HTTPS real e o HSTS seja coerente.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // 🔒 Segurança HTTP (headers) + HSTS (força HTTPS por 1 ano nos browsers).
  app.use(
    helmet({
      crossOriginResourcePolicy: false, // evita conflito com Swagger/UI
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  );

  // 🌐 CORS controlado
  const origins = config.get<string>('CORS_ORIGINS', '*');

  app.enableCors({
    origin:
      origins === '*'
        ? true
        : origins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // 📌 Prefixo global + versionamento
  // Resultado final: /api/v1/*
  // /metrics fica fora do prefixo/versão (padrão de scrape do Prometheus).
  app.setGlobalPrefix('api', { exclude: ['metrics'] });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // 🧼 Validação global (anti mass assignment) + tipos estritos.
  // enableImplicitConversion DESLIGADO: coerção silenciosa (ex.: number→string)
  // é risco em dado clínico. DTOs que precisam converter usam @Type() explícito
  // (ver PaginationQueryDto). forbidUnknownValues protege contra payloads não-objeto.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  // 📚 Swagger (OpenAPI) — NUNCA em produção: expõe toda a superfície da API e
  // os schemas, servindo de mapa para um atacante. Só em dev/homologação.
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Prontuário Eletrônico E2 — API')
      .setDescription('API REST do PE-E2 (NestJS + Prisma + PostgreSQL).')
      .setVersion('2.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('PORT', 3000);

  await app.listen(port);

  // 📢 Logs claros (inclui versão!)
  console.log(`🚀 API: http://localhost:${port}/api/v1`);
  if (!isProd) console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();