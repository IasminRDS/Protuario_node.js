/**
 * Catálogo de agravos de notificação compulsória (SINAN).
 *
 * Subconjunto representativo da Lista Nacional de Notificação Compulsória
 * (Portaria de Consolidação GM/MS nº 4/2017, Anexo 1, atualizada). Os CIDs são
 * prefixos NORMALIZADOS (maiúsculos, sem ponto): "A90" casa "A90", "A90.0" etc.
 *
 * `imediata: true` → notificação em até 24h (telefone/e-mail à vigilância);
 * `imediata: false` → fluxo semanal.
 */
export interface AgravoNotificavel {
  agravo: string;
  cids: string[];
  imediata: boolean;
}

export const AGRAVOS_NOTIFICAVEIS: AgravoNotificavel[] = [
  { agravo: 'Dengue', cids: ['A90'], imediata: false },
  { agravo: 'Dengue grave', cids: ['A91'], imediata: true },
  { agravo: 'Febre de Chikungunya', cids: ['A920'], imediata: false },
  { agravo: 'Infecção pelo vírus Zika', cids: ['A928', 'U069'], imediata: false },
  { agravo: 'Febre amarela', cids: ['A95'], imediata: true },
  { agravo: 'Malária', cids: ['B50', 'B51', 'B52', 'B53', 'B54'], imediata: true },
  { agravo: 'Cólera', cids: ['A00'], imediata: true },
  { agravo: 'Febre tifoide', cids: ['A010'], imediata: false },
  { agravo: 'Tuberculose', cids: ['A15', 'A16', 'A17', 'A18', 'A19'], imediata: false },
  { agravo: 'Hanseníase', cids: ['A30'], imediata: false },
  { agravo: 'Doença meningocócica', cids: ['A39'], imediata: true },
  { agravo: 'Meningite (outras etiologias)', cids: ['G00', 'A87'], imediata: false },
  { agravo: 'Sarampo', cids: ['B05'], imediata: true },
  { agravo: 'Rubéola', cids: ['B06'], imediata: true },
  { agravo: 'Coqueluche', cids: ['A37'], imediata: false },
  { agravo: 'Difteria', cids: ['A36'], imediata: true },
  { agravo: 'Tétano neonatal', cids: ['A33'], imediata: true },
  { agravo: 'Tétano acidental', cids: ['A34', 'A35'], imediata: false },
  { agravo: 'Poliomielite / paralisia flácida aguda', cids: ['A80'], imediata: true },
  { agravo: 'Raiva humana', cids: ['A82'], imediata: true },
  { agravo: 'Hantavirose', cids: ['A985'], imediata: true },
  { agravo: 'Leptospirose', cids: ['A27'], imediata: false },
  { agravo: 'Hepatites virais', cids: ['B15', 'B16', 'B17', 'B18', 'B19'], imediata: false },
  { agravo: 'HIV / aids', cids: ['B20', 'B21', 'B22', 'B23', 'B24', 'Z21'], imediata: false },
  { agravo: 'Sífilis congênita', cids: ['A50'], imediata: false },
  { agravo: 'Sífilis adquirida / em gestante', cids: ['A51', 'A52', 'A53'], imediata: false },
  { agravo: 'Leishmaniose visceral', cids: ['B550'], imediata: false },
  { agravo: 'Doença de Chagas aguda', cids: ['B570', 'B571'], imediata: true },
  { agravo: 'COVID-19', cids: ['U071', 'U072'], imediata: true },
  { agravo: 'Síndrome respiratória aguda grave (SRAG)', cids: ['J09', 'J10', 'J11'], imediata: true },
  { agravo: 'Botulismo', cids: ['A051'], imediata: true },
  { agravo: 'Peste', cids: ['A20'], imediata: true },
  { agravo: 'Varíola dos macacos (mpox)', cids: ['B04'], imediata: true },
  { agravo: 'Acidente por animal peçonhento', cids: ['X20', 'X21', 'X22', 'X23', 'X24', 'X25', 'X26', 'X27', 'X29'], imediata: false },
];

/** Normaliza um CID-10 para comparação por prefixo (maiúsculo, sem ponto). */
export function normalizeCid(cid: string): string {
  return cid.toUpperCase().replace(/[.\s-]/g, '');
}

/** Retorna o agravo notificável correspondente ao CID, ou null. */
export function findAgravo(cid: string): AgravoNotificavel | null {
  const norm = normalizeCid(cid);
  if (!norm) return null;
  return (
    AGRAVOS_NOTIFICAVEIS.find((a) => a.cids.some((p) => norm.startsWith(p))) ??
    null
  );
}
