/**
 * Motor de concorrência DETERMINÍSTICO para testes (F0.2). Sem `setTimeout`:
 * o interleaving é controlado por gates (barreiras) resolvidas manualmente, o
 * que torna a execução 100% replayable.
 *
 * `Gate` = ponto de pausa: uma coroutine faz `await gate.wait()` e só prossegue
 * quando o teste chama `gate.open()`. Isso permite forçar ordens específicas
 * (ex.: pausar a request A antes do commit enquanto a request B dá rollback).
 */
export class Gate {
  private opened = false;
  private waiters: Array<() => void> = [];

  /** Bloqueia até `open()`. Determinístico (sem timer). */
  wait(): Promise<void> {
    if (this.opened) return Promise.resolve();
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  /** Libera todos os que aguardam (idempotente). */
  open(): void {
    this.opened = true;
    const pending = this.waiters;
    this.waiters = [];
    pending.forEach((r) => r());
  }
}

export const gate = (): Gate => new Gate();

/** Trace de execução para asserção de determinismo/replay. */
export class Trace {
  private readonly steps: string[] = [];
  mark(step: string): void {
    this.steps.push(step);
  }
  get(): readonly string[] {
    return this.steps.slice();
  }
}
