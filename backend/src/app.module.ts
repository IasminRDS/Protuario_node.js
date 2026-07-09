import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { validateEnv } from './infra/config/env';
import { PrismaModule } from './infra/prisma/prisma.module';

import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { PermissionsGuard } from './shared/guards/permissions.guard';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';
import { AccessAuditInterceptor } from './shared/interceptors/access-audit.interceptor';
import { TenantTxInterceptor } from './shared/interceptors/tenant-tx.interceptor';
import { TraceIdMiddleware } from './shared/observability/trace-id.middleware';
import { TenantMiddleware } from './shared/tenant/tenant.middleware';
import { EventBusModule } from './shared/events/event-bus.module';

import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { AuthModule } from './modules/auth/auth.module';
import { PacientesModule } from './modules/pacientes/pacientes.module';
import { PerfisModule } from './modules/perfis/perfis.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { MpiModule } from './modules/mpi/mpi.module';

// FASE 1 — módulos clínicos
import { ClinicalModule } from './modules/clinical/clinical.module';
import { TriageModule } from './modules/triage/triage.module';
import { EncountersModule } from './modules/encounters/encounters.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { LocksModule } from './modules/locks/locks.module';
import { ProntuarioModule } from './modules/prontuario/prontuario.module';
import { FhirModule } from './infra/fhir/fhir.module';
import { HospitalsModule } from './modules/hospitals/hospitals.module';
import { ConsistencyModule } from './modules/consistency/consistency.module';

// FASE 2 — módulos hospitalares (migração paridade Flask)
import { InternacaoModule } from './modules/internacao/internacao.module';
import { ProntoSocorroModule } from './modules/pronto-socorro/pronto-socorro.module';
import { ExamesModule } from './modules/exames/exames.module';
import { PrescricaoHospitalarModule } from './modules/prescricao-hospitalar/prescricao-hospitalar.module';
import { CirurgiaModule } from './modules/cirurgia/cirurgia.module';

// FASE 5 — produção hospitalar
import { PdfModule } from './modules/pdf/pdf.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CsvImportModule } from './modules/csv-import/csv-import.module';
import { BackupModule } from './modules/backup/backup.module';
import { AuditModule } from './modules/audit/audit.module';
import { ExportModule } from './modules/export/export.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    // Melhor prática: usar ConfigService ao invés de process.env direto
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60),
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    PrismaModule,
    EventBusModule, // backbone de eventos (SNPE)
    AuditoriaModule,
    AuthModule,
    PerfisModule,
    UsuariosModule,
    PacientesModule,

    // SNPE — primeiro núcleo produtivo
    OutboxModule,
    MpiModule,

    // FASE 1 — clínico
    ClinicalModule,
    TriageModule,
    EncountersModule,
    PrescriptionsModule,
    LocksModule,
    ProntuarioModule,
    FhirModule, // interoperabilidade FHIR R4
    HospitalsModule, // multi-tenancy (gestão de hospitais)
    ConsistencyModule, // F0.6-B — monitor de invariantes (Camada B)

    // FASE 2 — hospitalar
    InternacaoModule,
    ProntoSocorroModule,
    ExamesModule,
    PrescricaoHospitalarModule,
    CirurgiaModule,

    // FASE 5 — produção
    AuditModule, // auditoria de exportação unificada (LGPD) — global
    PdfModule,
    ReportsModule,
    CsvImportModule,
    BackupModule,
    ExportModule,
  ],

  providers: [
    // IMPORTANTE: ordem NÃO é garantida aqui no Nest
    // A lógica correta deve estar dentro dos Guards se houver dependência

    // Autorização unificada: rate-limit -> autenticação -> permissões (única camada).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard }, // RBAC institucional (roles→permissions)

    // F0.2: transação-por-request (mais externo) — abre 1 tx p/ mutações.
    { provide: APP_INTERCEPTOR, useClass: TenantTxInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Auditoria de não-repúdio (CNJ/LGPD): super-admin + acesso a PHI. Additivo.
    { provide: APP_INTERCEPTOR, useClass: AccessAuditInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // TenantMiddleware primeiro: abre o AsyncLocalStorage que envolve toda a
    // requisição (o JwtStrategy preenche o hospitalId depois). Em seguida traceId.
    consumer.apply(TenantMiddleware, TraceIdMiddleware).forRoutes('*');
  }
}
