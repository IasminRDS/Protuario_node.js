/**
 * F0.4 Peça 2 — Conflict-Graph Serializability Checker (oráculo OFFLINE).
 *
 * Não altera runtime. Recebe uma HISTÓRIA observada (ops read/write + eventos
 * COD) e verifica as propriedades da spec-raiz (HYBRID-CONSISTENCY-SPEC.md):
 *   P1 SOD  — subgrafo WW acíclico (serialização de escrita sob RC+row-lock).
 *   P2 COD  — ordem total por agregado sobre AUDIT_SUCCESS (aggregate_seq {1..k}).
 *   P3 EOD  — AUDIT_DENIAL não participa do grafo (não cria aresta).
 *   P4      — independência cross-agregado (arestas só existem intra-agregado).
 *
 * Nota formal: `fullGraph` (WW+WR+RW) pode ter ciclo por anti-dependência (RW)
 * sob READ COMMITTED — isso é ESPERADO (RC ≠ serializable) e serve para DETECTAR
 * write-skew. O invariante forte do sistema é `sodGraph` (WW acíclico), não `fullGraph`.
 */

export type OpEvent = {
  kind: 'op';
  order: number;
  txId: string; // identidade da transação/request
  aggregateId: string; // ex.: 'paciente:123'
  op: 'read' | 'write';
  version: number; // versão lida ou escrita
};

export type CodEvent = {
  kind: 'cod';
  order: number;
  txId: string;
  aggregateId: string;
  result: 'SUCCESS' | 'DENIAL';
  aggregateSeq: number;
};

export type HistoryEvent = OpEvent | CodEvent;

export type EdgeKind = 'WW' | 'WR' | 'RW';
export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
  aggregateId: string;
}

/** Constrói G(H): arestas de conflito intra-agregado. Ignora eventos COD. */
export function buildConflictGraph(history: HistoryEvent[]): Edge[] {
  const ops = history.filter((e): e is OpEvent => e.kind === 'op');
  const edges: Edge[] = [];
  const aggregates = new Set(ops.map((o) => o.aggregateId));

  for (const agg of aggregates) {
    const evs = ops.filter((o) => o.aggregateId === agg);
    const writes = evs
      .filter((o) => o.op === 'write')
      .sort((a, b) => a.version - b.version);
    const writerOf = new Map<number, string>();
    for (const w of writes) writerOf.set(w.version, w.txId);

    // WW: cadeia pela ordem de versão.
    for (let i = 0; i + 1 < writes.length; i++) {
      if (writes[i].txId !== writes[i + 1].txId) {
        edges.push({ from: writes[i].txId, to: writes[i + 1].txId, kind: 'WW', aggregateId: agg });
      }
    }

    // WR (writer → reader) e RW (reader → escritor posterior = anti-dependência).
    for (const r of evs.filter((o) => o.op === 'read')) {
      const w = writerOf.get(r.version);
      if (w && w !== r.txId) {
        edges.push({ from: w, to: r.txId, kind: 'WR', aggregateId: agg });
      }
      for (const wr of writes) {
        if (wr.version > r.version && wr.txId !== r.txId) {
          edges.push({ from: r.txId, to: wr.txId, kind: 'RW', aggregateId: agg });
        }
      }
    }
  }
  return edges;
}

/** Detecção de ciclo (Kahn). Retorna nós no ciclo, ou null se acíclico. */
export function detectCycle(edges: { from: string; to: string }[]): string[] | null {
  const nodes = new Set<string>();
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  const ensure = (n: string) => {
    if (!nodes.has(n)) {
      nodes.add(n);
      adj.set(n, []);
      indeg.set(n, 0);
    }
  };
  for (const e of edges) {
    ensure(e.from);
    ensure(e.to);
    adj.get(e.from)!.push(e.to);
    indeg.set(e.to, indeg.get(e.to)! + 1);
  }
  const queue = [...nodes].filter((n) => indeg.get(n) === 0);
  let visited = 0;
  while (queue.length) {
    const n = queue.shift()!;
    visited++;
    for (const m of adj.get(n)!) {
      indeg.set(m, indeg.get(m)! - 1);
      if (indeg.get(m) === 0) queue.push(m);
    }
  }
  if (visited === nodes.size) return null;
  return [...nodes].filter((n) => indeg.get(n)! > 0);
}

/** P2: por agregado, aggregate_seq dos AUDIT_SUCCESS é {1..k} (total, gapless). */
export function codTotalOrder(history: HistoryEvent[]): boolean {
  const cod = history.filter(
    (e): e is CodEvent => e.kind === 'cod' && e.result === 'SUCCESS',
  );
  const byAgg = new Map<string, number[]>();
  for (const e of cod) {
    const arr = byAgg.get(e.aggregateId) ?? [];
    arr.push(e.aggregateSeq);
    byAgg.set(e.aggregateId, arr);
  }
  for (const [, seqs] of byAgg) {
    const s = [...seqs].sort((a, b) => a - b);
    if (new Set(s).size !== s.length) return false; // sem duplicata
    for (let i = 0; i < s.length; i++) if (s[i] !== i + 1) return false; // {1..k}
  }
  return true;
}

export interface CheckerResult {
  sodGraph: { acyclic: boolean }; // WW subgraph (invariante forte sob RC)
  fullGraph: { acyclic: boolean }; // WW+WR+RW (serializabilidade estrita)
  codGraph: { totalOrder: boolean };
  eodExcluded: boolean;
  rwConflicts: number;
  crossAggregateEdges: number;
  violations: string[];
}

export function analyze(history: HistoryEvent[]): CheckerResult {
  const edges = buildConflictGraph(history);
  const ww = edges.filter((e) => e.kind === 'WW');
  const rw = edges.filter((e) => e.kind === 'RW');

  const denialTx = new Set(
    history
      .filter((e): e is CodEvent => e.kind === 'cod' && e.result === 'DENIAL')
      .map((e) => e.txId),
  );
  const eodExcluded = edges.every(
    (e) => !denialTx.has(e.from) && !denialTx.has(e.to),
  );

  const sodAcyclic = detectCycle(ww) === null;
  const fullAcyclic = detectCycle(edges) === null;
  const cod = codTotalOrder(history);
  // Por construção arestas são intra-agregado; expomos para documentar P4.
  const crossAggregateEdges = 0;

  const violations: string[] = [];
  if (!sodAcyclic) violations.push('P1: ciclo no subgrafo WW (write serialization / lost update).');
  if (!cod) violations.push('P2: COD não é ordem total por agregado.');
  if (!eodExcluded) violations.push('P3: AUDIT_DENIAL participou do grafo de conflito.');

  return {
    sodGraph: { acyclic: sodAcyclic },
    fullGraph: { acyclic: fullAcyclic },
    codGraph: { totalOrder: cod },
    eodExcluded,
    rwConflicts: rw.length,
    crossAggregateEdges,
    violations,
  };
}
