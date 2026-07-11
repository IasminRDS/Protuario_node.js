import { Injectable } from '@nestjs/common';
import { CID10, type Cid10 } from './cid10.catalog';
import { MEDICAMENTOS, type Medicamento } from './medicamentos.catalog';

/** Normaliza para busca: minúsculas, sem acentos. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Terminologias oficiais (CID-10, medicamentos). Catálogos em memória com
 * índice normalizado pré-computado — busca por código (prefixo) ou por
 * descrição (substring, sem acento).
 */
@Injectable()
export class TerminologiaService {
  private readonly cid10 = CID10.map((c) => ({
    ...c,
    _codigo: norm(c.codigo).replace('.', ''),
    _texto: norm(c.descricao),
  }));

  private readonly medicamentos = MEDICAMENTOS.map((m) => ({
    ...m,
    _texto: norm(`${m.nome} ${m.apresentacao}`),
  }));

  buscarCid10(q: string, limit = 20): Cid10[] {
    const termo = norm(q.trim());
    if (!termo) return [];
    const termoCodigo = termo.replace('.', '');

    return this.cid10
      .filter(
        (c) => c._codigo.startsWith(termoCodigo) || c._texto.includes(termo),
      )
      .slice(0, limit)
      .map(({ codigo, descricao }) => ({ codigo, descricao }));
  }

  descricaoCid10(codigo: string): string | null {
    const alvo = norm(codigo).replace('.', '');
    // Match exato primeiro; senão o prefixo mais específico (E11.9 → E11).
    const exato = this.cid10.find((c) => c._codigo === alvo);
    if (exato) return exato.descricao;
    const prefixo = this.cid10
      .filter((c) => alvo.startsWith(c._codigo))
      .sort((a, b) => b._codigo.length - a._codigo.length)[0];
    return prefixo?.descricao ?? null;
  }

  buscarMedicamentos(q: string, limit = 20): Medicamento[] {
    const termo = norm(q.trim());
    if (!termo) return [];
    return this.medicamentos
      .filter((m) => m._texto.includes(termo))
      .slice(0, limit)
      .map(({ nome, apresentacao, via }) => ({ nome, apresentacao, via }));
  }
}
