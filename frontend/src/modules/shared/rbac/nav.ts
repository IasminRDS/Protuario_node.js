import {
  LayoutDashboard,
  Users,
  Stethoscope,
  ClipboardList,
  FileText,
  Pill,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from './permissions';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** permissão(ões) que liberam o item (qualquer uma). Vazio = todos autenticados. */
  any?: Permission[];
}

// Navegação orientada ao fluxo clínico, controlada por permissão granular.
export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pacientes', label: 'Pacientes', icon: Users, any: ['patient:read'] },
  { href: '/triagem', label: 'Triagem', icon: ClipboardList, any: ['triage:write'] },
  { href: '/atendimentos', label: 'Atendimentos', icon: Stethoscope, any: ['clinical:write'] },
  { href: '/prontuario', label: 'Prontuário', icon: FileText, any: ['clinical:read'] },
  { href: '/prescricao', label: 'Prescrição', icon: Pill, any: ['prescription:create'] },
  { href: '/auditoria', label: 'Auditoria', icon: ShieldCheck, any: ['audit:read'] },
];
