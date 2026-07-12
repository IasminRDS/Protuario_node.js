import { api } from './api';
import type { ApiEnvelope } from '@/types';

export type TipoEnvioRnds = 'RAC' | 'RIA' | 'RESULTADO_EXAME';
export type StatusEnvioRnds = 'PENDENTE' | 'ENVIADO' | 'ERRO';

export interface EnvioRnds {
  id: string;
  tipo: TipoEnvioRnds;
  recursoTipo: string;
  entityId: string;
  pacienteId: string | null;
  pacienteNome: string | null;
  status: StatusEnvioRnds;
  protocolo: string | null;
  mensagem: string | null;
  criadoEm: string;
  enviadoEm: string | null;
}

export const rndsService = {
  async listar(status?: string): Promise<EnvioRnds[]> {
    const { data } = await api.get<ApiEnvelope<EnvioRnds[]>>('/rnds/envios', {
      params: status ? { status } : undefined,
    });
    return data.data;
  },

  async enviar(tipo: TipoEnvioRnds, entityId: string): Promise<EnvioRnds> {
    const { data } = await api.post<ApiEnvelope<EnvioRnds>>('/rnds/enviar', {
      tipo,
      entityId,
    });
    return data.data;
  },

  async reenviar(id: string): Promise<EnvioRnds> {
    const { data } = await api.post<ApiEnvelope<EnvioRnds>>(
      `/rnds/envios/${id}/reenviar`,
      {},
    );
    return data.data;
  },

  async preview(tipo: TipoEnvioRnds, entityId: string): Promise<unknown> {
    const { data } = await api.get<ApiEnvelope<unknown>>(
      `/rnds/preview/${tipo}/${entityId}`,
    );
    return data.data;
  },
};
