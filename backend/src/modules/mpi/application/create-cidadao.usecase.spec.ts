import { Prisma } from '@prisma/client';
import { DomainEvent } from '../../events/base.event';
import { EventType } from '../../events/event-types';
import { Cidadao } from '../domain/cidadao.entity';
import {
  CidadaoRepository,
  HeuristicKey,
} from '../domain/cidadao.repository';
import { IdentityKey } from '../domain/identity-keys';
import { OutboxPort } from '../../outbox/outbox.port';
import { MpiTxContext, MpiUnitOfWork } from './ports/mpi-unit-of-work';
import { CreateCidadaoUseCase } from './create-cidadao.usecase';

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: 'test',
  });

class InMemoryCidadaoRepo implements CidadaoRepository {
  saved: Cidadao[] = [];
  keys = new Map<string, string>();

  async findByCpf(cpf: string) {
    return this.saved.find((c) => c.cpf === cpf) ?? null;
  }
  async findByCns(cns: string) {
    return this.saved.find((c) => c.cns === cns) ?? null;
  }
  private match(key: HeuristicKey) {
    return this.saved.filter(
      (c) =>
        c.nome.toLowerCase() === key.nome.toLowerCase() &&
        c.dataNascimento.getTime() === key.dataNascimento.getTime(),
    );
  }
  async findByHeuristic(key: HeuristicKey) {
    return this.match(key)[0] ?? null;
  }
  async findActiveByHeuristic(key: HeuristicKey) {
    return this.match(key);
  }
  async findCidadaoIdByKey(key: string) {
    return this.keys.get(key) ?? null;
  }
  async save(c: Cidadao) {
    this.saved.push(c);
  }
  async insertIdentityKeys(cidadaoId: string, keys: IdentityKey[]) {
    for (const k of keys) {
      if (this.keys.has(k.key)) throw p2002();
      this.keys.set(k.key, cidadaoId);
    }
  }
  async linkIdentityKeysIgnoreConflict(cidadaoId: string, keys: IdentityKey[]) {
    for (const k of keys) if (!this.keys.has(k.key)) this.keys.set(k.key, cidadaoId);
  }
  async enrichIdentifiers() {
    /* no-op para teste */
  }
}

class InMemoryOutbox implements OutboxPort {
  events: DomainEvent[] = [];
  async enqueue(event: DomainEvent) {
    this.events.push(event);
  }
}

class FakeUnitOfWork implements MpiUnitOfWork {
  constructor(private readonly ctx: MpiTxContext) {}
  execute<T>(work: (ctx: MpiTxContext) => Promise<T>): Promise<T> {
    return work(this.ctx);
  }
}

describe('CreateCidadaoUseCase', () => {
  let repo: InMemoryCidadaoRepo;
  let outbox: InMemoryOutbox;
  let useCase: CreateCidadaoUseCase;

  beforeEach(() => {
    repo = new InMemoryCidadaoRepo();
    outbox = new InMemoryOutbox();
    useCase = new CreateCidadaoUseCase(
      new FakeUnitOfWork({ cidadaoRepo: repo, outbox }),
      repo,
    );
  });

  const input = {
    nome: 'Maria da Silva',
    dataNascimento: '1990-05-20',
    cpf: '529.982.247-25',
  };

  it('cria cidadão novo, registra chave de identidade e emite CidadaoCreated', async () => {
    const out = await useCase.execute(input);

    expect(out.resolved).toBe(false);
    expect(repo.saved).toHaveLength(1);
    expect(repo.keys.get('cpf:52998224725')).toBe(out.cidadaoId);
    expect(outbox.events[0].type).toBe(EventType.CIDADAO_CREATED);
  });

  it('deduplica por CPF (chave de identidade): não cria novo, emite CidadaoResolved', async () => {
    const first = await useCase.execute(input);
    const second = await useCase.execute(input);

    expect(second.resolved).toBe(true);
    expect(second.matchedBy).toBe('CPF');
    expect(second.cidadaoId).toBe(first.cidadaoId);
    expect(repo.saved).toHaveLength(1);
    expect(outbox.events.map((e) => e.type)).toEqual([
      EventType.CIDADAO_CREATED,
      EventType.CIDADAO_RESOLVED,
    ]);
  });

  it('split CPF × sem-CPF: registro sem CPF resolve para o existente e vincula', async () => {
    const comCpf = await useCase.execute(input);
    // Mesma pessoa, agora SEM CPF (só demografia) -> deve resolver ao existente.
    const semCpf = await useCase.execute({
      nome: 'Maria da Silva',
      dataNascimento: '1990-05-20',
    });

    expect(semCpf.resolved).toBe(true);
    expect(semCpf.matchedBy).toBe('HEURISTIC');
    expect(semCpf.cidadaoId).toBe(comCpf.cidadaoId);
    expect(repo.saved).toHaveLength(1); // sem split
  });

  it('corrida (P2002 na criação): resolve para o vencedor, sem 2º cidadão', async () => {
    const winner = Cidadao.create({
      nome: input.nome,
      dataNascimento: new Date(input.dataNascimento),
      cpf: { value: '52998224725' } as never,
      cns: null,
    });
    const readRepo = new InMemoryCidadaoRepo();
    await readRepo.save(winner);
    await readRepo.insertIdentityKeys(winner.id, [
      { key: 'cpf:52998224725', kind: 'CPF' },
    ]);

    const raceOutbox = new InMemoryOutbox();
    let call = 0;
    const racingUow = {
      execute: jest.fn(async (work: (ctx: MpiTxContext) => Promise<unknown>) => {
        call += 1;
        if (call === 1) throw p2002();
        return work({
          cidadaoRepo: new InMemoryCidadaoRepo(),
          outbox: raceOutbox,
        });
      }),
    };

    const uc = new CreateCidadaoUseCase(
      racingUow as unknown as MpiUnitOfWork,
      readRepo,
    );
    const out = await uc.execute(input);

    expect(out.resolved).toBe(true);
    expect(out.cidadaoId).toBe(winner.id);
    expect(out.matchedBy).toBe('CPF');
    expect(raceOutbox.events.map((e) => e.type)).toEqual([
      EventType.CIDADAO_RESOLVED,
    ]);
  });
});
