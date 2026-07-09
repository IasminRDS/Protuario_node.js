// Espelha o ImportResponseDto do backend.
export interface ImportErro {
  linha: number;
  erro: string;
}

export interface ImportPreview {
  nome: string;
  cpf: string;
  dataNascimento: string;
  sexo: string | null;
}

export interface ImportResponse {
  total: number;
  validos: number;
  invalidos: number;
  erros: ImportErro[];
  sucesso: boolean;
  fileHash: string;
  preview: ImportPreview[];
}
