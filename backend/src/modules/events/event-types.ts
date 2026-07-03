/** Catálogo de tipos de evento (versionados no envelope, não no nome). */
export enum EventType {
  CIDADAO_CREATED = 'CidadaoCreated',
  CIDADAO_RESOLVED = 'CidadaoResolved',
  CIDADAO_MERGED = 'CidadaoMerged',
}

/** Prefixo de tópico por bounded context (usado no roteamento Kafka). */
export const TOPIC_MPI = 'snpe.mpi';
