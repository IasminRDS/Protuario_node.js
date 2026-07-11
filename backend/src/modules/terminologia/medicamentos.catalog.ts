/**
 * Catálogo de medicamentos — subconjunto curado da RENAME (Relação Nacional
 * de Medicamentos Essenciais) com apresentações comuns. Embutido para
 * autocomplete; a carga completa (RENAME/CATMAT oficial) entra por seed em
 * fase posterior.
 */
export interface Medicamento {
  nome: string; // denominação genérica (DCB)
  apresentacao: string;
  via: string;
}

export const MEDICAMENTOS: Medicamento[] = [
  // Analgésicos / antitérmicos / anti-inflamatórios
  { nome: 'Dipirona sódica', apresentacao: '500 mg comprimido', via: 'oral' },
  { nome: 'Dipirona sódica', apresentacao: '500 mg/mL solução injetável', via: 'intravenosa' },
  { nome: 'Paracetamol', apresentacao: '500 mg comprimido', via: 'oral' },
  { nome: 'Paracetamol', apresentacao: '200 mg/mL solução oral (gotas)', via: 'oral' },
  { nome: 'Ibuprofeno', apresentacao: '600 mg comprimido', via: 'oral' },
  { nome: 'Ibuprofeno', apresentacao: '50 mg/mL suspensão oral', via: 'oral' },
  { nome: 'Diclofenaco sódico', apresentacao: '50 mg comprimido', via: 'oral' },
  { nome: 'Ácido acetilsalicílico', apresentacao: '100 mg comprimido', via: 'oral' },
  { nome: 'Tramadol', apresentacao: '50 mg/mL solução injetável', via: 'intravenosa' },
  { nome: 'Morfina', apresentacao: '10 mg/mL solução injetável', via: 'intravenosa' },
  // Antibióticos
  { nome: 'Amoxicilina', apresentacao: '500 mg cápsula', via: 'oral' },
  { nome: 'Amoxicilina + clavulanato de potássio', apresentacao: '875 mg + 125 mg comprimido', via: 'oral' },
  { nome: 'Azitromicina', apresentacao: '500 mg comprimido', via: 'oral' },
  { nome: 'Cefalexina', apresentacao: '500 mg cápsula', via: 'oral' },
  { nome: 'Ceftriaxona', apresentacao: '1 g pó para solução injetável', via: 'intravenosa' },
  { nome: 'Ciprofloxacino', apresentacao: '500 mg comprimido', via: 'oral' },
  { nome: 'Sulfametoxazol + trimetoprima', apresentacao: '400 mg + 80 mg comprimido', via: 'oral' },
  { nome: 'Benzilpenicilina benzatina', apresentacao: '1.200.000 UI pó para suspensão injetável', via: 'intramuscular' },
  { nome: 'Metronidazol', apresentacao: '250 mg comprimido', via: 'oral' },
  { nome: 'Nitrofurantoína', apresentacao: '100 mg cápsula', via: 'oral' },
  { nome: 'Vancomicina', apresentacao: '500 mg pó para solução injetável', via: 'intravenosa' },
  { nome: 'Piperacilina + tazobactam', apresentacao: '4 g + 0,5 g pó para solução injetável', via: 'intravenosa' },
  // Cardiovascular
  { nome: 'Losartana potássica', apresentacao: '50 mg comprimido', via: 'oral' },
  { nome: 'Enalapril', apresentacao: '10 mg comprimido', via: 'oral' },
  { nome: 'Captopril', apresentacao: '25 mg comprimido', via: 'oral' },
  { nome: 'Anlodipino', apresentacao: '5 mg comprimido', via: 'oral' },
  { nome: 'Hidroclorotiazida', apresentacao: '25 mg comprimido', via: 'oral' },
  { nome: 'Furosemida', apresentacao: '40 mg comprimido', via: 'oral' },
  { nome: 'Furosemida', apresentacao: '10 mg/mL solução injetável', via: 'intravenosa' },
  { nome: 'Espironolactona', apresentacao: '25 mg comprimido', via: 'oral' },
  { nome: 'Atenolol', apresentacao: '50 mg comprimido', via: 'oral' },
  { nome: 'Carvedilol', apresentacao: '6,25 mg comprimido', via: 'oral' },
  { nome: 'Sinvastatina', apresentacao: '20 mg comprimido', via: 'oral' },
  { nome: 'Atorvastatina', apresentacao: '20 mg comprimido', via: 'oral' },
  { nome: 'Varfarina sódica', apresentacao: '5 mg comprimido', via: 'oral' },
  { nome: 'Enoxaparina sódica', apresentacao: '40 mg/0,4 mL solução injetável', via: 'subcutânea' },
  { nome: 'Digoxina', apresentacao: '0,25 mg comprimido', via: 'oral' },
  { nome: 'Amiodarona', apresentacao: '200 mg comprimido', via: 'oral' },
  { nome: 'Nitroglicerina', apresentacao: '5 mg/mL solução injetável', via: 'intravenosa' },
  // Diabetes
  { nome: 'Metformina', apresentacao: '850 mg comprimido', via: 'oral' },
  { nome: 'Glibenclamida', apresentacao: '5 mg comprimido', via: 'oral' },
  { nome: 'Gliclazida', apresentacao: '60 mg comprimido de liberação prolongada', via: 'oral' },
  { nome: 'Insulina humana NPH', apresentacao: '100 UI/mL suspensão injetável', via: 'subcutânea' },
  { nome: 'Insulina humana regular', apresentacao: '100 UI/mL solução injetável', via: 'subcutânea' },
  // Respiratório
  { nome: 'Salbutamol', apresentacao: '100 mcg/dose aerossol', via: 'inalatória' },
  { nome: 'Ipratrópio, brometo', apresentacao: '0,25 mg/mL solução para nebulização', via: 'inalatória' },
  { nome: 'Beclometasona', apresentacao: '250 mcg/dose aerossol', via: 'inalatória' },
  { nome: 'Prednisona', apresentacao: '20 mg comprimido', via: 'oral' },
  { nome: 'Prednisolona', apresentacao: '3 mg/mL solução oral', via: 'oral' },
  { nome: 'Hidrocortisona, succinato', apresentacao: '100 mg pó para solução injetável', via: 'intravenosa' },
  { nome: 'Dexametasona', apresentacao: '4 mg/mL solução injetável', via: 'intravenosa' },
  // Gastro
  { nome: 'Omeprazol', apresentacao: '20 mg cápsula', via: 'oral' },
  { nome: 'Pantoprazol', apresentacao: '40 mg pó para solução injetável', via: 'intravenosa' },
  { nome: 'Ranitidina', apresentacao: '150 mg comprimido', via: 'oral' },
  { nome: 'Ondansetrona', apresentacao: '2 mg/mL solução injetável', via: 'intravenosa' },
  { nome: 'Metoclopramida', apresentacao: '10 mg comprimido', via: 'oral' },
  { nome: 'Bromoprida', apresentacao: '10 mg comprimido', via: 'oral' },
  { nome: 'Sais para reidratação oral', apresentacao: 'pó para solução oral (envelope)', via: 'oral' },
  // Neuro / psiquiatria
  { nome: 'Fenitoína', apresentacao: '100 mg comprimido', via: 'oral' },
  { nome: 'Fenobarbital', apresentacao: '100 mg comprimido', via: 'oral' },
  { nome: 'Carbamazepina', apresentacao: '200 mg comprimido', via: 'oral' },
  { nome: 'Ácido valproico', apresentacao: '500 mg comprimido', via: 'oral' },
  { nome: 'Diazepam', apresentacao: '10 mg comprimido', via: 'oral' },
  { nome: 'Diazepam', apresentacao: '5 mg/mL solução injetável', via: 'intravenosa' },
  { nome: 'Clonazepam', apresentacao: '2 mg comprimido', via: 'oral' },
  { nome: 'Haloperidol', apresentacao: '5 mg comprimido', via: 'oral' },
  { nome: 'Risperidona', apresentacao: '2 mg comprimido', via: 'oral' },
  { nome: 'Fluoxetina', apresentacao: '20 mg cápsula', via: 'oral' },
  { nome: 'Sertralina', apresentacao: '50 mg comprimido', via: 'oral' },
  { nome: 'Amitriptilina', apresentacao: '25 mg comprimido', via: 'oral' },
  // Anti-histamínicos / alergia
  { nome: 'Loratadina', apresentacao: '10 mg comprimido', via: 'oral' },
  { nome: 'Dexclorfeniramina', apresentacao: '2 mg comprimido', via: 'oral' },
  { nome: 'Prometazina', apresentacao: '25 mg/mL solução injetável', via: 'intramuscular' },
  { nome: 'Epinefrina (adrenalina)', apresentacao: '1 mg/mL solução injetável', via: 'intramuscular' },
  // Antiparasitários / antifúngicos / antivirais
  { nome: 'Albendazol', apresentacao: '400 mg comprimido mastigável', via: 'oral' },
  { nome: 'Ivermectina', apresentacao: '6 mg comprimido', via: 'oral' },
  { nome: 'Fluconazol', apresentacao: '150 mg cápsula', via: 'oral' },
  { nome: 'Nistatina', apresentacao: '100.000 UI/mL suspensão oral', via: 'oral' },
  { nome: 'Aciclovir', apresentacao: '200 mg comprimido', via: 'oral' },
  { nome: 'Oseltamivir', apresentacao: '75 mg cápsula', via: 'oral' },
  // Ginecologia / obstetrícia
  { nome: 'Ocitocina', apresentacao: '5 UI/mL solução injetável', via: 'intravenosa' },
  { nome: 'Sulfato de magnésio', apresentacao: '500 mg/mL solução injetável', via: 'intravenosa' },
  { nome: 'Ácido fólico', apresentacao: '5 mg comprimido', via: 'oral' },
  { nome: 'Sulfato ferroso', apresentacao: '40 mg Fe²⁺ comprimido', via: 'oral' },
  // Soluções e emergência
  { nome: 'Cloreto de sódio 0,9%', apresentacao: '500 mL solução para infusão', via: 'intravenosa' },
  { nome: 'Glicose 5%', apresentacao: '500 mL solução para infusão', via: 'intravenosa' },
  { nome: 'Ringer lactato', apresentacao: '500 mL solução para infusão', via: 'intravenosa' },
  { nome: 'Atropina', apresentacao: '0,25 mg/mL solução injetável', via: 'intravenosa' },
  { nome: 'Noradrenalina', apresentacao: '2 mg/mL solução injetável', via: 'intravenosa' },
  { nome: 'Dopamina', apresentacao: '5 mg/mL solução injetável', via: 'intravenosa' },
  { nome: 'Naloxona', apresentacao: '0,4 mg/mL solução injetável', via: 'intravenosa' },
  { nome: 'Flumazenil', apresentacao: '0,1 mg/mL solução injetável', via: 'intravenosa' },
];
