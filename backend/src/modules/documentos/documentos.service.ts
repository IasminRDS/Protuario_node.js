import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SigningService } from '../../infra/crypto/signing.service';

export interface RegistroAssinatura {
  tipo: 'PRONTUARIO' | 'PRESCRICAO' | 'ALTA';
  pacienteId?: bigint | null;
  hospitalId?: string | null;
  signatarioId?: string | null;
  signatarioNome: string;
  signatarioDoc?: string | null;
}

@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signing: SigningService,
  ) {}

  /** SHA-256 hex do conteúdo do PDF. */
  hashDocumento(pdf: Buffer): string {
    return createHash('sha256').update(pdf).digest('hex');
  }

  /**
   * Persiste a assinatura de um documento já com o `id` gerado (o QR do PDF
   * aponta para esse id antes do hash existir, evitando dependência circular).
   */
  async registrar(
    id: string,
    pdf: Buffer,
    reg: RegistroAssinatura,
  ): Promise<{ hash: string; assinatura: string }> {
    const hash = this.hashDocumento(pdf);
    const assinatura = this.signing.assinar(hash);

    await this.prisma.documentoAssinado.create({
      data: {
        id,
        tipo: reg.tipo,
        pacienteId: reg.pacienteId ?? null,
        hospitalId: reg.hospitalId ?? null,
        signatarioId: reg.signatarioId ? BigInt(reg.signatarioId) : null,
        signatarioNome: reg.signatarioNome,
        signatarioDoc: reg.signatarioDoc ?? null,
        hashDocumento: hash,
        assinatura,
        algoritmo: this.signing.algoritmo,
      },
    });

    return { hash, assinatura };
  }

  /**
   * Verificação PÚBLICA (sem PHI): confirma que o documento foi emitido e
   * assinado pelo SNPE e que a assinatura confere com o hash registrado.
   */
  async verificar(id: string) {
    const doc = await this.prisma.documentoAssinado
      .findUnique({ where: { id } })
      .catch(() => null);
    if (!doc) throw new NotFoundException('Documento não encontrado.');

    const valido = this.signing.verificar(doc.hashDocumento, doc.assinatura);
    const TIPO_LABEL: Record<string, string> = {
      PRONTUARIO: 'Prontuário clínico',
      PRESCRICAO: 'Prescrição',
      ALTA: 'Sumário de alta hospitalar',
    };

    return {
      id: doc.id,
      tipo: doc.tipo,
      tipoLabel: TIPO_LABEL[doc.tipo] ?? doc.tipo,
      signatario: doc.signatarioNome,
      signatarioDoc: doc.signatarioDoc,
      emitidoEm: doc.emitidoEm,
      hash: doc.hashDocumento,
      algoritmo: doc.algoritmo,
      assinaturaValida: valido,
    };
  }
}
