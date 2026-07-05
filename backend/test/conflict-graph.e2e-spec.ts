import {
  analyze,
  buildConflictGraph,
  detectCycle,
  HistoryEvent,
  OpEvent,
  CodEvent,
} from './utils/conflict-graph';

// Helpers de história (puros — sem banco, determinístico).
let ord = 0;
const w = (txId: string, aggregateId: string, version: number): OpEvent => ({
  kind: 'op', order: ord++, txId, aggregateId, op: 'write', version,
});
const r = (txId: string, aggregateId: string, version: number): OpEvent => ({
  kind: 'op', order: ord++, txId, aggregateId, op: 'read', version,
});
const success = (txId: string, aggregateId: string, aggregateSeq: number): CodEvent => ({
  kind: 'cod', order: ord++, txId, aggregateId, result: 'SUCCESS', aggregateSeq,
});
const denial = (txId: string, aggregateId: string, aggregateSeq: number): CodEvent => ({
  kind: 'cod', order: ord++, txId, aggregateId, result: 'DENIAL', aggregateSeq,
});

describe('Conflict-Graph Checker (oráculo puro — F0.4 Peça 2)', () => {
  beforeEach(() => (ord = 0));

  it('história serial (T1 escreve v1; T2 lê v1 e escreve v2) → acíclica; aresta WR', () => {
    const h: HistoryEvent[] = [w('T1', 'p:1', 1), r('T2', 'p:1', 1), w('T2', 'p:1', 2)];
    const edges = buildConflictGraph(h);
    expect(edges.some((e) => e.kind === 'WR' && e.from === 'T1' && e.to === 'T2')).toBe(true);
    const res = analyze(h);
    expect(res.sodGraph.acyclic).toBe(true);
    expect(res.fullGraph.acyclic).toBe(true);
  });

  it('WRITE-SKEW/lost-update (T1,T2 leem v0; escrevem v1,v2) → fullGraph CÍCLICO detectado', () => {
    const h: HistoryEvent[] = [
      r('T1', 'p:1', 0), r('T2', 'p:1', 0), w('T1', 'p:1', 1), w('T2', 'p:1', 2),
    ];
    const res = analyze(h);
    // WW serializa (acíclico), MAS a anti-dependência RW cria ciclo no grafo completo:
    expect(res.sodGraph.acyclic).toBe(true); // write serialization ok (RC+row-lock)
    expect(res.fullGraph.acyclic).toBe(false); // ANOMALIA detectada (RC ≠ serializable)
    expect(res.rwConflicts).toBeGreaterThan(0);
  });

  it('P3 — EOD exclusion: adicionar AUDIT_DENIAL NÃO muda o grafo', () => {
    const base: HistoryEvent[] = [w('T1', 'p:1', 1), success('T1', 'p:1', 1)];
    const withDenial: HistoryEvent[] = [...base, denial('D1', 'p:1', 1)];
    expect(buildConflictGraph(withDenial)).toEqual(buildConflictGraph(base));
    expect(analyze(withDenial).eodExcluded).toBe(true);
    expect(analyze(withDenial).violations).toEqual([]);
  });

  it('P2 — COD total order: {1,2,3} passa; {1,3} (gap) falha', () => {
    const ok: HistoryEvent[] = [success('T1', 'p:1', 1), success('T2', 'p:1', 2), success('T3', 'p:1', 3)];
    expect(analyze(ok).codGraph.totalOrder).toBe(true);
    const gap: HistoryEvent[] = [success('T1', 'p:1', 1), success('T2', 'p:1', 3)];
    expect(analyze(gap).codGraph.totalOrder).toBe(false);
  });

  it('P4 — independência cross-agregado: escritas em p:1 e p:2 → sem arestas', () => {
    const h: HistoryEvent[] = [w('T1', 'p:1', 1), w('T2', 'p:2', 1)];
    const edges = buildConflictGraph(h);
    expect(edges).toHaveLength(0);
    const res = analyze(h);
    expect(res.sodGraph.acyclic).toBe(true);
    expect(res.crossAggregateEdges).toBe(0);
  });

  it('detectCycle: grafo com ciclo A→B→A é detectado', () => {
    expect(detectCycle([{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }])).not.toBeNull();
    expect(detectCycle([{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }])).toBeNull();
  });
});
