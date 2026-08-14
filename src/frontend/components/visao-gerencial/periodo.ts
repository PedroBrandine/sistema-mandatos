// visao-gerencial-g3-g6, fix pós-Verifier (Blocker): o filtro "Período"
// (FiltroRecorte.mesesEvolucao) era capturado da URL (BarraRecorte, T20) mas
// nunca lido em nenhum consumidor -- os gráficos de evolução sempre
// mostravam os 12 meses inteiros, tornando o Select "Período" um controle
// sem efeito. context.md ("Filtro Período"): controla exclusivamente o
// range do eixo X dos gráficos de evolução, nunca reprocessa a query (as
// views *_mensal sempre trazem os 12 meses fixos) -- por isso o corte é só
// de exibição, aplicado aqui, no último elo antes do componente de gráfico.
export function apararUltimosMeses<T>(itens: T[], mesesEvolucao: number | undefined): T[] {
  return mesesEvolucao === undefined ? itens : itens.slice(-mesesEvolucao);
}
