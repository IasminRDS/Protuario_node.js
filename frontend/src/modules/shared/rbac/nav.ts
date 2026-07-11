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

// Navegação orientada ao fluxo clínico, controlada por permissão granular.
export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pacientes', label: 'Pacientes', icon: Users, any: ['patient:read'] },
  { href: '/pronto-socorro', label: 'Pronto-Socorro', icon: Ambulance, any: ['emergency:write'] },
  { href: '/triagem', label: 'Triagem', icon: ClipboardList, any: ['triage:write'] },
  { href: '/internacao', label: 'Internação', icon: BedDouble, any: ['internment:write'] },
  { href: '/atendimentos', label: 'Atendimentos', icon: Stethoscope, any: ['clinical:write'] },
  { href: '/prontuario', label: 'Prontuário', icon: FileText, any: ['clinical:read'] },
  { href: '/prescricao', label: 'Prescrição', icon: Pill, any: ['prescription:create'] },
  { href: '/vigilancia', label: 'Vigilância', icon: Siren, any: ['surveillance:read'] },
  { href: '/regulacao', label: 'Regulação', icon: ArrowLeftRight, any: ['regulation:read'] },
  { href: '/epidemiologia', label: 'Epidemiologia', icon: Map, any: ['reports:read'] },
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
  // Conta (MFA/segurança): visível a todos os autenticados.
  { href: '/conta', label: 'Minha conta', icon: UserCog },
];
