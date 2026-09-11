// EST-07 (T14, .specs/features/redesenho-estrategia-tela-first/tasks.md).
// Função pura: traduz "quanto da duração prevista da etapa já se passou" em
// um estado de badge para o card do Quadro de Acompanhamento.
//
// AD-045: o limiar é PERCENTUAL da duração prevista da própria etapa
// (ref_etapa.duracao_prevista_dias), não dias absolutos -- Atenção a 70%,
// Atrasado a 100%. Os dois percentuais chegam por parâmetro (`limiares`),
// nunca cravados aqui (AD-004) -- design.md (pré-AD-045) descrevia a
// assinatura como `classificarLimiar(diasNaEtapa, limiares)`; o parâmetro
// `duracaoPrevistaDias` foi acrescentado porque, sem a duração da etapa, não
// há base pra calcular percentual algum (SPEC_DEVIATION, ver Registro de
// execução do Batch 4).
//
// AD-005: ausência nunca vira sentinela. Etapa sem duracao_prevista_dias
// (coluna nullable de origem) não é classificável e a migration
// 20260910201447 já deixa explícito que esse caso "renderiza Normal, nunca
// um estado inventado" -- mesma regra para limiares ausentes/inativos (a
// view correspondente já os exclui via CROSS JOIN, mas a função aqui nunca
// lança se de qualquer forma chegarem nulos).
export type EstadoLimiarEtapa = "normal" | "atencao" | "atrasado";

export interface LimiaresEtapa {
  atencaoPct: number | null;
  atrasadoPct: number | null;
}

export function classificarLimiar(
  diasNaEtapa: number,
  duracaoPrevistaDias: number | null | undefined,
  limiares: LimiaresEtapa | null | undefined
): EstadoLimiarEtapa {
  if (duracaoPrevistaDias === null || duracaoPrevistaDias === undefined || duracaoPrevistaDias <= 0) {
    return "normal";
  }
  if (!limiares) return "normal";

  const pctDecorrido = (diasNaEtapa / duracaoPrevistaDias) * 100;

  if (limiares.atrasadoPct !== null && limiares.atrasadoPct !== undefined && pctDecorrido >= limiares.atrasadoPct) {
    return "atrasado";
  }
  if (limiares.atencaoPct !== null && limiares.atencaoPct !== undefined && pctDecorrido >= limiares.atencaoPct) {
    return "atencao";
  }
  return "normal";
}
