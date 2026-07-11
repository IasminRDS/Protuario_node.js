import { ExportacaoPage } from '@/modules/export/components/ExportacaoPage';

export default function ExportacaoRoute() {
  // O gating por perfil (export vs. backup) é feito dentro do componente, que
  // também cobre o caso "sem acesso". O backend é a autoridade final do RBAC.
  return <ExportacaoPage />;
}
