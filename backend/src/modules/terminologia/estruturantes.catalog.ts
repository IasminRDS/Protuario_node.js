/**
 * Cadastros estruturantes do SUS (subconjuntos curados para autocomplete):
 *  - CBO: Classificação Brasileira de Ocupações (profissional de saúde);
 *  - SIGTAP: procedimentos do SUS (Tabela de Procedimentos);
 *  - CNES: estabelecimentos de saúde (amostra).
 * A carga oficial completa (DATASUS) entra por importação em fase posterior.
 */
export interface CboItem {
  codigo: string;
  descricao: string;
}
export interface SigtapItem {
  codigo: string;
  descricao: string;
}
export interface CnesItem {
  cnes: string;
  nome: string;
  municipio: string;
  uf: string;
}

export const CBO: CboItem[] = [
  { codigo: '225125', descricao: 'Médico clínico' },
  { codigo: '225110', descricao: 'Médico infectologista' },
  { codigo: '225120', descricao: 'Médico cardiologista' },
  { codigo: '225103', descricao: 'Médico anestesiologista' },
  { codigo: '225150', descricao: 'Médico pediatra' },
  { codigo: '225170', descricao: 'Médico cirurgião geral' },
  { codigo: '225124', descricao: 'Médico ginecologista e obstetra' },
  { codigo: '225133', descricao: 'Médico psiquiatra' },
  { codigo: '223505', descricao: 'Enfermeiro' },
  { codigo: '223565', descricao: 'Enfermeiro da estratégia de saúde da família' },
  { codigo: '322205', descricao: 'Técnico de enfermagem' },
  { codigo: '223405', descricao: 'Cirurgião-dentista' },
  { codigo: '223810', descricao: 'Farmacêutico' },
  { codigo: '223605', descricao: 'Fisioterapeuta' },
  { codigo: '223710', descricao: 'Nutricionista' },
  { codigo: '251510', descricao: 'Psicólogo clínico' },
  { codigo: '223905', descricao: 'Assistente social' },
];

export const SIGTAP: SigtapItem[] = [
  { codigo: '0301010013', descricao: 'Consulta médica em atenção básica' },
  { codigo: '0301010072', descricao: 'Consulta médica em atenção especializada' },
  { codigo: '0301060029', descricao: 'Atendimento de urgência com observação até 24h' },
  { codigo: '0202010473', descricao: 'Hemograma completo' },
  { codigo: '0202010295', descricao: 'Dosagem de glicose' },
  { codigo: '0202010600', descricao: 'Dosagem de creatinina' },
  { codigo: '0202030229', descricao: 'Teste rápido para dengue' },
  { codigo: '0205020097', descricao: 'Ultrassonografia abdominal total' },
  { codigo: '0204030153', descricao: 'Radiografia de tórax (PA e perfil)' },
  { codigo: '0211060100', descricao: 'Eletrocardiograma' },
  { codigo: '0303010037', descricao: 'Tratamento de pneumonia' },
  { codigo: '0303140135', descricao: 'Tratamento de diabetes mellitus' },
  { codigo: '0409060089', descricao: 'Parto normal' },
  { codigo: '0411010026', descricao: 'Parto cesariano' },
  { codigo: '0301100039', descricao: 'Aplicação de vacina (imunização)' },
];

export const CNES: CnesItem[] = [
  { cnes: '2077485', nome: 'Hospital Geral de Fortaleza', municipio: 'Fortaleza', uf: 'CE' },
  { cnes: '2295415', nome: 'Hospital das Clínicas da UFBA', municipio: 'Salvador', uf: 'BA' },
  { cnes: '2269481', nome: 'UPA 24h Centro', municipio: 'Salvador', uf: 'BA' },
  { cnes: '5717256', nome: 'UBS Vila Nova', municipio: 'Feira de Santana', uf: 'BA' },
  { cnes: '0011800', nome: 'Hospital das Clínicas FMUSP', municipio: 'São Paulo', uf: 'SP' },
  { cnes: '2237601', nome: 'Hospital Municipal Souza Aguiar', municipio: 'Rio de Janeiro', uf: 'RJ' },
];
