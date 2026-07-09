import { createHash } from 'crypto';
import { Readable } from 'stream';
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { parse } from 'csv-parse';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditExportService } from '../audit/audit.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { isValidCpf, limparCpf } from './validators/cpf.validator';
import {
  ImportErroDto,
  ImportPreviewDto,
  ImportResponseDto,
} from './dto/import-response.dto';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIMES_OK = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/octet-stream',
  'text/plain',
]);

interface LinhaCru {
  linha: number;
  raw: Record<string, string>;
}
interface PacienteNovo {
  linha: number;
  nome: string;
  cpf: string;
  dataNascimento: Date;
  sexo: string;
}

@Injectable()
export class CsvImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditExport: AuditExportService,
  ) {}

  /**
   * Pipeline: upload → parsing (streaming) → validação linha a linha → commit.
   * Modo STRICT: se houver QUALQUER erro, NADA é inserido (rollback total). O
   * import_log é gravado SEMPRE (sucesso ou falha).
   */
  async importPacientes(
    file: Express.Multer.File,
    actor: AuthenticatedUser,
  ): Promise<ImportResponseDto> {
    this.assertArquivo(file); // não confiar no controller/frontend
    const hospitalId = currentHospitalId();
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');

    // 1) PARSING STREAMING sobre o buffer (limitado a 5MB) — sem readFileSync/disco.
    const linhas = await this.parseStream(file.buffer);
    const total = linhas.length;
    const erros: ImportErroDto[] = [];

    // 2) Validação linha a linha + deduplicação DENTRO do CSV.
    const candidatos: PacienteNovo[] = [];
    const cpfsNoArquivo = new Set<string>();
    for (const { linha, raw } of linhas) {
      const parsed = this.validarLinha(raw);
      if ('erro' in parsed) {
        erros.push({ linha, erro: parsed.erro });
        continue;
      }
      if (cpfsNoArquivo.has(parsed.cpf)) {
        erros.push({ linha, erro: 'CPF duplicado dentro do arquivo' });
        continue;
      }
      cpfsNoArquivo.add(parsed.cpf);
      candidatos.push({ ...parsed, linha });
    }

    // 3) Deduplicação contra o BANCO. O schema tem CPF único GLOBAL, então a
    // verificação é global (não só por hospital) — caso contrário o createMany
    // violaria a unique constraint e derrubaria a transação inteira.
    const finais = await this.removerJaCadastrados(candidatos, erros);

    const validos = finais.length;
    const invalidos = total - validos;
    let sucesso = total > 0 && invalidos === 0;

    // 4) COMMIT — só grava em modo STRICT (tudo válido). Tudo em UMA transação.
    if (sucesso) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.paciente.createMany({
            data: finais.map((p) => ({
              nome: p.nome,
              cpf: p.cpf,
              sexo: p.sexo,
              dataNascimento: p.dataNascimento,
              hospitalId, // tenant do usuário autenticado (nunca do CSV)
              createdBy: BigInt(actor.id),
            })),
          });
        });
      } catch (e) {
        sucesso = false;
        erros.push({
          linha: 0,
          erro: `Falha ao gravar em lote: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }

    // 5) Auditoria: import_log SEMPRE + trilha LGPD unificada.
    await this.registrarLog(actor, hospitalId, file, fileHash, total, validos, invalidos, sucesso, erros);

    return {
      total,
      validos,
      invalidos,
      erros,
      sucesso,
      fileHash,
      preview: this.montarPreview(candidatos),
    };
  }

  // --- Segurança -------------------------------------------------------------
  private assertArquivo(file: Express.Multer.File | undefined): void {
    if (!file || !file.buffer) {
      throw new BadRequestException('Arquivo é obrigatório (campo "file").');
    }
    if (!/\.csv$/i.test(file.originalname)) {
      throw new BadRequestException('Extensão inválida: envie um arquivo .csv.');
    }
    if (!MIMES_OK.has(file.mimetype)) {
      throw new BadRequestException(`Tipo de arquivo não permitido: ${file.mimetype}.`);
    }
    if (file.size > MAX_BYTES) {
      throw new PayloadTooLargeException('Arquivo excede o limite de 5MB.');
    }
  }

  // --- Parsing (streaming) ---------------------------------------------------
  private parseStream(buffer: Buffer): Promise<LinhaCru[]> {
    return new Promise((resolve, reject) => {
      const linhas: LinhaCru[] = [];
      let numero = 1; // linha 1 = cabeçalho
      const parser = parse({
        delimiter: ';',
        columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
        trim: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true,
      });
      parser.on('readable', () => {
        let record: Record<string, string> | null;
        while ((record = parser.read() as Record<string, string> | null) !== null) {
          numero += 1;
          linhas.push({ linha: numero, raw: record });
        }
      });
      parser.on('error', (err) =>
        reject(new BadRequestException(`CSV malformado: ${err.message}`)),
      );
      parser.on('end', () => resolve(linhas));
      Readable.from(buffer).pipe(parser);
    });
  }

  // --- Validação de uma linha ------------------------------------------------
  private validarLinha(
    raw: Record<string, string>,
  ): PacienteNovo | { erro: string } {
    const nome = (raw.nome ?? '').trim();
    if (!nome) return { erro: 'Nome é obrigatório' };

    const cpf = limparCpf(raw.cpf);
    if (!cpf) return { erro: 'CPF é obrigatório' };
    if (!isValidCpf(cpf)) return { erro: 'CPF inválido' };

    const dn = (raw.data_nascimento ?? '').trim();
    if (!dn) return { erro: 'Data de nascimento é obrigatória' };
    if (!/^\d{4}-\d{2}-\d{2}/.test(dn)) {
      return { erro: 'Data de nascimento deve estar em ISO (YYYY-MM-DD)' };
    }
    const data = new Date(dn);
    if (Number.isNaN(data.getTime())) {
      return { erro: 'Data de nascimento inválida' };
    }

    let sexo = (raw.sexo ?? '').trim().toUpperCase();
    if (sexo && sexo !== 'M' && sexo !== 'F') {
      return { erro: 'Sexo inválido (use M ou F)' };
    }
    if (!sexo) sexo = 'O'; // opcional no CSV; coluna é obrigatória no banco

    return { linha: 0, nome, cpf, dataNascimento: data, sexo };
  }

  // --- Dedup contra o banco --------------------------------------------------
  private async removerJaCadastrados(
    candidatos: PacienteNovo[],
    erros: ImportErroDto[],
  ): Promise<PacienteNovo[]> {
    if (candidatos.length === 0) return [];
    const existentes = await this.prisma.paciente.findMany({
      where: { cpf: { in: candidatos.map((c) => c.cpf) }, deletedAt: null },
      select: { cpf: true },
    });
    const jaExiste = new Set(existentes.map((e) => e.cpf));
    const finais: PacienteNovo[] = [];
    for (const c of candidatos) {
      if (jaExiste.has(c.cpf)) {
        erros.push({ linha: c.linha, erro: 'CPF já cadastrado no sistema' });
      } else {
        finais.push(c);
      }
    }
    return finais;
  }

  private montarPreview(candidatos: PacienteNovo[]): ImportPreviewDto[] {
    return candidatos.slice(0, 5).map((c) => ({
      nome: c.nome,
      cpf: c.cpf,
      dataNascimento: c.dataNascimento.toISOString().slice(0, 10),
      sexo: c.sexo,
    }));
  }

  private async registrarLog(
    actor: AuthenticatedUser,
    hospitalId: string | null,
    file: Express.Multer.File,
    fileHash: string,
    total: number,
    validos: number,
    invalidos: number,
    sucesso: boolean,
    erros: ImportErroDto[],
  ): Promise<void> {
    await this.prisma.importLog.create({
      data: {
        usuarioId: BigInt(actor.id),
        hospitalId,
        filename: file.originalname,
        fileHash,
        totalLinhas: total,
        validos,
        invalidos,
        sucesso,
        errosJson: erros as unknown as Prisma.InputJsonValue,
      },
    });
    // Auditoria LGPD unificada (import_log guarda o detalhe; aqui a trilha padrão).
    await this.auditExport.logExport({
      tipo: 'CSV_IMPORT',
      acao: 'IMPORTAR',
      status: sucesso ? 'SUCESSO' : 'FALHA',
      userId: actor.id,
      hospitalId,
      metadata: {
        filename: file.originalname,
        fileHash,
        total,
        validos,
        invalidos,
        erros: erros.slice(0, 50),
      },
    });
  }
}
