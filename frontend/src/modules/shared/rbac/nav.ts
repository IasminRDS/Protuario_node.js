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
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from './permissions';
import type { Perfil } from '@/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
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
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    titulo: 'Atendimento',
    items: [
      { href: '/pacientes', label: 'Pacientes', icon: Users, any: ['patient:read'] },
      { href: '/pronto-socorro', label: 'Pronto-Socorro', icon: Ambulance, any: ['emergency:write'] },
      { href: '/triagem', label: 'Triagem', icon: ClipboardList, any: ['triage:write'] },
      { href: '/atendimentos', label: 'Atendimentos', icon: Stethoscope, any: ['clinical:write'] },
      { href: '/prontuario', label: 'Prontuário', icon: FileText, any: ['clinical:read'] },
      { href: '/prescricao', label: 'Prescrição', icon: Pill, any: ['prescription:create'] },
      { href: '/internacao', label: 'Internação', icon: BedDouble, any: ['internment:write'] },
    ],
  },
  {
    titulo: 'Vigilância e Regulação',
    items: [
      { href: '/vigilancia', label: 'Vigilância (SINAN)', icon: Siren, any: ['surveillance:read'] },
      { href: '/regulacao', label: 'Regulação de vagas', icon: ArrowLeftRight, any: ['regulation:read'] },
      { href: '/epidemiologia', label: 'Epidemiologia', icon: Map, any: ['reports:read'] },
    ],
  },
  {
    titulo: 'Gestão',
    items: [
      { href: '/relatorios', label: 'Relatórios', icon: BarChart3, any: ['reports:read'] },
      { href: '/importacao', label: 'Importar CSV', icon: Upload, any: ['patient:create'] },
      {
        href: '/exportacao',
        label: 'Exportação',
        icon: DownloadCloud,
        // RBAC por perfil: export (Admin/Recepção) ou backup (SuperAdmin).
        roles: ['Administrador', 'Recepcao', 'SuperAdmin'],
      },
      { href: '/auditoria', label: 'Auditoria', icon: ShieldCheck, any: ['audit:read'] },
    ],
  },
  {
    titulo: 'Conta',
    items: [{ href: '/conta', label: 'Minha conta', icon: UserCog }],
  },
];

/** Lista plana (compatibilidade com consumidores existentes). */
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
