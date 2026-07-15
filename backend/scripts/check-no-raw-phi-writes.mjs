#!/usr/bin/env node
/**
 * Guarda de segurança: nenhum caminho de código pode ESCREVER em tabelas de PHI
 * via SQL cru ($executeRaw/$queryRaw[Unsafe]) — isso contornaria a criptografia
 * de campo em repouso (que atua no middleware do Prisma, não em SQL cru).
 *
 * Leituras cruas são permitidas (relatórios, views). Só INSERT/UPDATE nas tabelas
 * com colunas cifradas são bloqueados. Migrations/seed rodam como dono e estão
 * fora de src/ — não são varridos.
 *
 * Roda no CI (falha o build) e localmente: `node scripts/check-no-raw-phi-writes.mjs`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const PHI_TABLES = ['paciente', 'prontuario', 'exame_solicitado', 'internacao'];
// $executeRaw... seguido, em até 400 chars, de INSERT INTO/UPDATE numa tabela PHI.
const RE = new RegExp(
  String.raw`\$(?:execute|query)Raw(?:Unsafe)?[\s\S]{0,400}?(?:INSERT\s+INTO|UPDATE)\s+"?(?:${PHI_TABLES.join('|')})"?`,
  'gi',
);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8');
  const m = src.match(RE);
  if (m) violations.push({ file: file.replace(SRC, 'src'), hits: m.length });
}

if (violations.length) {
  console.error('✗ Escrita CRUA em tabela de PHI detectada (contorna a cifra em repouso):');
  for (const v of violations) console.error(`  - ${v.file} (${v.hits})`);
  console.error('Use os métodos do Prisma (não SQL cru) para gravar nessas tabelas.');
  process.exit(1);
}
console.log('✓ Nenhuma escrita crua em tabela de PHI.');
