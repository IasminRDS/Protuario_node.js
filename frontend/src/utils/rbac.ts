import type { Perfil } from '@/types';
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

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Perfil[]; // perfis que enxergam/acessam
}

const ALL: Perfil[] = [
  'Administrador',
  'Medico',
  'Enfermeiro',
  'Farmaceutico',
  'Recepcao',
  'Gestor',
];

// Navegação e RBAC de UI (o backend é a autoridade real de autorização).
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
  {
    href: '/pacientes',
    label: 'Pacientes',
    icon: Users,
    roles: ['Administrador', 'Recepcao', 'Medico', 'Enfermeiro', 'Gestor'],
  },
  {
    href: '/triagem',
    label: 'Triagem',
    icon: ClipboardList,
    roles: ['Administrador', 'Enfermeiro'],
  },
  {
    href: '/atendimentos',
    label: 'Atendimentos',
    icon: Stethoscope,
    roles: ['Administrador', 'Medico'],
  },
  {
    href: '/prontuario',
    label: 'Prontuário',
    icon: FileText,
    roles: ['Administrador', 'Medico', 'Enfermeiro', 'Gestor'],
  },
  {
    href: '/prescricao',
    label: 'Prescrição',
    icon: Pill,
    roles: ['Administrador', 'Medico', 'Farmaceutico'],
  },
  {
    href: '/auditoria',
    label: 'Auditoria',
    icon: ShieldCheck,
    roles: ['Administrador', 'Gestor'],
  },
];

export function navFor(perfil: Perfil): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(perfil));
}

export function canAccess(perfil: Perfil, href: string): boolean {
  const item = NAV_ITEMS.find((i) => href.startsWith(i.href));
  return item ? item.roles.includes(perfil) : true;
}
