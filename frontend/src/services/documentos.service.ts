import { api } from './api';
import type { ApiEnvelope } from '@/types';

export interface VerificacaoDocumento {
  id: string;
  tipo: string;
  tipoLabel: string;
  signatario: string;
  signatarioDoc: string | null;
  emitidoEm: string;
  hash: string;
  algoritmo: string;
  assinaturaValida: boolean;
}

export const documentosService = {
  async verificar(id: string): Promise<VerificacaoDocumento> {
    const { data } = await api.get<ApiEnvelope<VerificacaoDocumento>>(
      `/documentos/verificar/${id}`,
    );
    return data.data;
  },
};
