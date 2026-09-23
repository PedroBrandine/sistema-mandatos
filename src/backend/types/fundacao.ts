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
  nmUe?: string | null;
  sgPartido: string | null;
  cdCargo: number | null;
  // PF2-05 (.specs/features/pente-fino-2026-09-23/spec.md): cargo e situação
  // da candidatura (eleito/suplente/não eleito/etc.), já expostos por
  // tse.mv_candidatura_resumo (ds_cargo/ds_sit_tot_turno, migration 0010) --
  // só faltava mapear até a UI, sem migration nova. Opcional (em vez de
  // `string | null`) para não obrigar os demais construtores de
  // CandidaturaSugerida no codebase (fora do escopo desta task) a declarar
  // os 2 campos -- ausência e null recebem o mesmo tratamento "omite
  // graciosamente" na UI (AC3).
  dsCargo?: string | null;
  dsSitTotTurno?: string | null;
  dsGenero: string | null;
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
  idContrato: number | null;
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
  nmUe?: string | null;
}

// CAD-11: perfil demográfico do eleitorado do município principal da
// candidatura (tse.mv_perfil_eleitorado_candidatura), consumido por
// buscarPerfilEleitoradoCandidatura (tse.ts).
export interface PerfilEleitorado {
  genero: Array<{ categoria: string; qtEleitores: number }>;
  faixaEtaria: Array<{ categoria: string; qtEleitores: number }>;
  grauEscolaridade: Array<{ categoria: string; qtEleitores: number }>;
}

