import {
  LayoutDashboard,
  Users,
  Stethoscope,
  ClipboardList,
  FileText,
  Pill,
  ShieldCheck,
  Ambulance,
  BedDouble,
  BarChart3,
  Upload,
  DownloadCloud,
  Siren,
  ArrowLeftRight,
  Map,
  Network,
  IdCard,
  Table,
  Info,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from './permissions';
import type { Perfil } from '@/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Uma linha sobre o que a funcionalidade faz (cards do dashboard). */
  descricao?: string;
  /** permissão(ões) que liberam o item (qualquer uma). Vazio = todos autenticados. */
  any?: Permission[];
  /**
   * Perfil(is) que liberam o item, quando a autorização é por PERFIL (não por
   * permissão granular) — ex.: export/backup, cujo RBAC no backend é por role.
   * Se presente, o item aparece quando o perfil do usuário está na lista.
   */
  roles?: Perfil[];
}

/** Grupo de navegação (DSGov): título de seção + itens, filtrados por RBAC. */
export interface NavGroup {
  titulo: string | null; // null = sem cabeçalho (topo)
  items: NavItem[];
}

// Navegação orientada ao fluxo clínico, agrupada por domínio (padrão de
// sistemas gov: o operador acha a função pelo contexto, não por lista plana).
export const NAV_GROUPS: NavGroup[] = [
  {
    titulo: null,
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        descricao: 'Visão operacional do dia e acesso rápido às funcionalidades.',
      },
    ],
  },
  {
    titulo: 'Atendimento',
    items: [
      {
        href: '/pacientes',
        label: 'Pacientes',
        icon: Users,
        descricao: 'Cadastro, busca e Sumário do Paciente.',
        any: ['patient:read'],
      },
      {
        href: '/pronto-socorro',
        label: 'Pronto-Socorro',
        icon: Ambulance,
        descricao: 'Fila e atendimento de urgência e emergência.',
        any: ['emergency:write'],
      },
      {
        href: '/triagem',
        label: 'Triagem',
        icon: ClipboardList,
        descricao: 'Sinais vitais e classificação de risco Manchester.',
        any: ['triage:write'],
      },
      {
        href: '/atendimentos',
        label: 'Atendimentos',
        icon: Stethoscope,
        descricao: 'Consultas e evolução clínica ambulatorial.',
        any: ['clinical:write'],
      },
      {
        href: '/prontuario',
        label: 'Prontuário',
        icon: FileText,
        descricao: 'Histórico clínico longitudinal do paciente.',
        any: ['clinical:read'],
      },
      {
        href: '/portal-cidadao',
        label: 'Portal do Cidadão',
        icon: IdCard,
        descricao: 'Cartão de vacinas e "quem acessou meu prontuário" (LGPD).',
        any: ['clinical:read'],
      },
      {
        href: '/prescricao',
        label: 'Prescrição',
        icon: Pill,
        descricao: 'Prescrição com catálogo nacional de medicamentos (RENAME).',
        any: ['prescription:create'],
      },
      {
        href: '/internacao',
        label: 'Internação',
        icon: BedDouble,
        descricao: 'Leitos, internações, evoluções e altas.',
        any: ['internment:write'],
      },
    ],
  },
  {
    titulo: 'Vigilância e Regulação',
    items: [
      {
        href: '/vigilancia',
        label: 'Vigilância (SINAN)',
        icon: Siren,
        descricao: 'Fila de notificações compulsórias geradas por CID notificável.',
        any: ['surveillance:read'],
      },
      {
        href: '/regulacao',
        label: 'Regulação de vagas',
        icon: ArrowLeftRight,
        descricao: 'Fila de encaminhamentos entre unidades com parecer do regulador.',
        any: ['regulation:read'],
      },
      {
        href: '/epidemiologia',
        label: 'Epidemiologia',
        icon: Map,
        descricao: 'Painel regional: agravos, leitos, regulação e Manchester.',
        any: ['reports:read'],
      },
      {
        href: '/rnds',
        label: 'Integrações RNDS',
        icon: Network,
        descricao: 'Envio de registros clínicos (FHIR) à Rede Nacional de Dados em Saúde.',
        any: ['reports:read'],
      },
    ],
  },
  {
    titulo: 'Gestão',
    items: [
      {
        href: '/relatorios',
        label: 'Relatórios',
        icon: BarChart3,
        descricao: 'Indicadores e relatórios gerenciais.',
        any: ['reports:read'],
      },
      {
        href: '/importacao',
        label: 'Importar CSV',
        icon: Upload,
        descricao: 'Importação de pacientes em lote (validação estrita).',
        any: ['patient:create'],
      },
      {
        href: '/exportacao',
        label: 'Exportação',
        icon: DownloadCloud,
        descricao: 'Exportação de dados e backup — auditados (LGPD), exigem MFA.',
        // RBAC por perfil: export (Admin/Recepção) ou backup (SuperAdmin).
        roles: ['Administrador', 'Recepcao', 'SuperAdmin'],
      },
      {
        href: '/auditoria',
        label: 'Auditoria',
        icon: ShieldCheck,
        descricao: 'Trilha de auditoria com verificação de integridade (hash-chain).',
        any: ['audit:read'],
      },
      {
        href: '/tabelas',
        label: 'Tabelas oficiais',
        icon: Table,
        descricao: 'Consulta a CID-10, RENAME, CBO, SIGTAP e CNES.',
      },
    ],
  },
  {
    titulo: 'Conta',
    items: [
      {
        href: '/conta',
        label: 'Minha conta',
        icon: UserCog,
        descricao: 'Identificação e verificação em duas etapas (MFA).',
      },
      {
        href: '/sobre',
        label: 'Sobre o sistema',
        icon: Info,
        descricao: 'Versão, recursos e conformidade do SNPE.',
      },
    ],
  },
];

/** Lista plana (compatibilidade com consumidores existentes). */
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
