// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, FMC-12 e FMC-15.
// Funções puras (estratégia AD-042 do design.md) para os rótulos de tela da
// ficha do contrato -- vocabulário canônico confirmado com a skill
// figma-dominio-legisla (glossario-campos.md:19, ck_contrato_status).

export type StatusContrato = "ativo" | "concluido" | "nao_concluido";

// P1 Info AC8: "Histórico de Contratos" rotula `status` exatamente como
// Ativo / Concluído / Não concluído -- nunca "Em andamento" nem nome de
// etapa. Espelha `ck_contrato_status` (docs/schema_sistema.sql:506).
export function rotuloStatusContrato(status: StatusContrato): string {
  switch (status) {
    case "ativo":
      return "Ativo";
    case "concluido":
      return "Concluído";
    case "nao_concluido":
      return "Não concluído";
  }
}

// P1 Registro AC2: quando o Tipo tem `qtd_prevista` preenchida, exibe a
// sequência no formato "nº X de Y"; sem `qtd_prevista`, só "nº X" (A-13). Sem
// `nr` atribuído (registro ainda não criado / servidor ainda não numerou),
// devolve null -- quem chama decide o estado vazio, não esta função.
export function rotuloSequencia(nr: number | null, qtdPrevista: number | null): string | null {
  if (nr === null) return null;
  if (qtdPrevista === null) return `nº ${nr}`;
  return `nº ${nr} de ${qtdPrevista}`;
}
