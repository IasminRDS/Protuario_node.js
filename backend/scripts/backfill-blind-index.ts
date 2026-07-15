/**
 * Backfill do blind index (e da cifra) do CPF/CNS para linhas LEGADAS — as que
 * ficaram com cpf/cns em claro e *_bi NULL após a migration 20260718.
 *
 * Estratégia: reprocessa cada linha REESCREVENDO cpf/cns pelo próprio middleware
 * do Prisma (que cifra e calcula o blind index) — sem duplicar a lógica de
 * cripto. Idempotente: pula linhas já cifradas (cpf começa com "enc:v").
 *
 * Uso (com as chaves reais em produção):
 *   FIELD_ENCRYPTION_KEY=... BLIND_INDEX_KEY=... npx ts-node scripts/backfill-blind-index.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);

  // Lê em claro (o middleware decifra; linhas legadas em claro passam direto).
  const rows = await prisma.paciente.findMany({
    where: { OR: [{ cpfBi: null, cpf: { not: null } }, { cnsBi: null, cns: { not: null } }] },
    select: { id: true, cpf: true, cns: true, hospitalId: true },
  });

  let feitos = 0;
  for (const r of rows) {
    // Reescreve incluindo hospitalId → o middleware calcula o blind index ligado
    // ao tenant e cifra cpf/cns.
    await prisma.paciente.update({
      where: { id: r.id },
      data: {
        ...(r.cpf ? { cpf: r.cpf } : {}),
        ...(r.cns ? { cns: r.cns } : {}),
        hospitalId: r.hospitalId,
      },
    });
    feitos++;
  }

  // eslint-disable-next-line no-console
  console.log(`Backfill concluído: ${feitos} paciente(s) reprocessado(s).`);
  await app.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
