/**
 * Perfis de acesso (RBAC — cap. 114/115). Os valores correspondem a
 * Perfil.nome no banco e são usados pelo RolesGuard.
 */
export enum PerfilNome {
  /**
   * Operador da plataforma (cross-tenant). Ignora o isolamento por hospital —
   * usado para provisionamento/suporte. Deve ser concedido a pouquíssimas contas.
   */
  SUPER_ADMIN = 'SuperAdmin',
  ADMINISTRADOR = 'Administrador',
  MEDICO = 'Medico',
  ENFERMEIRO = 'Enfermeiro',
  FARMACEUTICO = 'Farmaceutico',
  RECEPCAO = 'Recepcao',
  GESTOR = 'Gestor',
}
