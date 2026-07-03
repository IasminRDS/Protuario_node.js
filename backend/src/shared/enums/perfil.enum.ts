/**
 * Perfis de acesso (RBAC — cap. 114/115). Os valores correspondem a
 * Perfil.nome no banco e são usados pelo RolesGuard.
 */
export enum PerfilNome {
  ADMINISTRADOR = 'Administrador',
  MEDICO = 'Medico',
  ENFERMEIRO = 'Enfermeiro',
  FARMACEUTICO = 'Farmaceutico',
  RECEPCAO = 'Recepcao',
  GESTOR = 'Gestor',
}
