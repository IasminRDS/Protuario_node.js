import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infra/prisma/prisma.service';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  container: StartedPostgreSqlContainer;
  close: () => Promise<void>;
}

/**
 * Sobe um PostgreSQL REAL (Testcontainers), aplica as migrations Prisma e
 * inicializa o AppModule completo — replicando o bootstrap de produção
 * (prefixo /api, versionamento, ValidationPipe, BigInt->string). Nada é mockado.
 */
export async function setupTestApp(): Promise<TestContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('prontuario_test')
    .withUsername('test')
    .withPassword('test')
    // tx-per-request (F0.2) segura 1 conexão por request → sob concorrência alta
    // é preciso pool/servidor com conexões suficientes (senão falha ao iniciar tx).
    .withCommand(['postgres', '-c', 'max_connections=200'])
    .start();

  // connection_limit ≥ concorrência esperada nos testes adversariais.
  const databaseUrl = `${container.getConnectionUri()}?connection_limit=80`;

  // ConfigModule valida o env no import do AppModule -> definir ANTES de compilar.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789';
  process.env.KAFKA_ENABLED = 'false';

  // Migrations reais contra o container (nada de SQLite, nada de push).
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  // BigInt -> string na serialização JSON (igual ao main.ts).
  (BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
    return this.toString();
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  await app.init();

  // Faz o servidor HTTP escutar UMA vez. Sem isto, cada `request(getHttpServer())`
  // do supertest dispara seu próprio `listen(0)`; sob `Promise.all` (testes de
  // concorrência) esses listens correm em paralelo no mesmo server → `read
  // ECONNRESET` intermitente (some localmente, aparece no CI mais lento). Com o
  // server já escutando, o supertest reutiliza o endereço sem re-listen.
  await new Promise<void>((resolve, reject) => {
    const server = app.getHttpServer();
    const onError = (err: unknown) => reject(err);
    server.once('error', onError);
    server.listen(0, () => {
      server.removeListener('error', onError);
      resolve();
    });
  });

  const prisma = app.get(PrismaService);

  // O ConfigModule carrega o .env COMMITADO, cujo valor de JWT_ACCESS_SECRET
  // vence o process.env. Alinhamos o segredo do signToken ao segredo EFETIVO
  // que o JwtStrategy usa, senão toda requisição autenticada dá 401.
  const config = app.get(ConfigService);
  process.env.JWT_ACCESS_SECRET = config.getOrThrow<string>('JWT_ACCESS_SECRET');
  process.env.JWT_REFRESH_SECRET = config.getOrThrow<string>('JWT_REFRESH_SECRET');

  return {
    app,
    prisma,
    container,
    close: async () => {
      await app.close();
      await container.stop();
    },
  };
}
