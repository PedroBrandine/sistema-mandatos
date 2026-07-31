// Tipos compostos de Fundação -- projeções/retornos que não existem 1:1 numa
// tabela gerada (database.types.ts). Definidos verbatim conforme design.md
// (## Data Models).

export interface CandidaturaSugerida {
  anoEleicao: number;
  sqCandidato: number;
  nrTurno: number;
  nrTituloEleitoral: string | null;
  nmCandidato: string | null;
  nmUrna: string | null;
  sgUf: string | null;
  nmMunicipioPrincipal: string | null;
  sgPartido: string | null;
  qtVotosTotal: number;
  metodoMatch: "titulo_eleitoral" | "nome_uf_cargo" | "manual";
  confianca: "alta" | "media" | "baixa";
}

export interface ContratanteSimilar {
  idContratante: number;
  nome: string;
  sgUf: string | null;
  nmMunicipio: string | null;
}

export interface MandatoCriado {
  idContratante: number;
  idMandato: number;
  idVinculoTse: number | null;
}

export interface CoalizaoCriada {
  idContratante: number;
  idCoalizao: number;
}

export interface VinculoEditavel {
  cargo?: "parlamentar" | "chefe_gabinete" | "assessor" | "secretaria_executiva" | "nao_se_aplica";
  grauResponsabilidade?: string | null;
  areas?: string[];
}

// CAD-10: perfil pessoal da candidatura (tse.dim_candidatura), consumido por
// buscarPerfilCandidatura (tse.ts).
export interface PerfilCandidatura {
  idade: number | null;
  genero: string | null;
  corRaca: string | null;
  grauInstrucao: string | null;
  ocupacao: string | null;
  coligacao: string | null;
}

