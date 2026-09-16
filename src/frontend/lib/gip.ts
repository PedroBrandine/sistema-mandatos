// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, FMC-28 (AC9-AC11).
// Funções puras (estratégia AD-042 do design.md): a régua de evolução do GIP
// deriva o rótulo e o resumo a partir do `gap` que já vem pronto de
// `vw_gip_evolucao` -- nunca recalculado aqui (AD-003/AD-014).

export interface LinhaEvolucaoGip {
  gap: number | null;
}

// AC9: gap > 0 -> "Subiu N nível(is)"; gap = 0 -> "Manteve"; gap < 0 ->
// "Regrediu N nível(is)". AC10 (visão Evolução com só um momento
// preenchido): gap chega null e o rótulo SHALL ser um estado explicativo,
// nunca "0" nem "-" silencioso.
//
// SPEC_DEVIATION: a spec não define o texto literal do estado explicativo
// (AC10 só exige que não seja "0" nem "-" silencioso). Escolhido
// "Aguardando o outro momento" -- spec-precision gap, ver validation.md.
export function rotuloEvolucaoGip(gap: number | null): string {
  if (gap === null) {
    return "Aguardando o outro momento";
  }

  if (gap === 0) {
    return "Manteve";
  }

  if (gap > 0) {
    return `Subiu ${gap} ${gap === 1 ? "nível" : "níveis"}`;
  }

  const regressao = Math.abs(gap);
  return `Regrediu ${regressao} ${regressao === 1 ? "nível" : "níveis"}`;
}

// AC11: o "Resumo da Evolução" soma exatamente o número de dimensões ativas
// com os dois momentos preenchidos -- dimensão com gap null (só um momento
// preenchido) não entra em nenhuma das três contagens.
export function resumoEvolucaoGip(linhas: LinhaEvolucaoGip[]): {
  evoluiram: number;
  mantiveram: number;
  regrediram: number;
} {
  let evoluiram = 0;
  let mantiveram = 0;
  let regrediram = 0;

  for (const linha of linhas) {
    if (linha.gap === null) continue;
    if (linha.gap > 0) evoluiram++;
    else if (linha.gap === 0) mantiveram++;
    else regrediram++;
  }

  return { evoluiram, mantiveram, regrediram };
}
