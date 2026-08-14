// PLR-16 (.specs/features/planejamento-estrategico-redesenho/spec.md). Utilitário
// compartilhado de parsing de percentual, usado tanto no commit de célula única quanto no
// split de colar em faixa (design.md -- "Colar em faixa"). Estende `validaPct` de hoje (só
// aceita ponto, sem `%`): aceita vírgula OU ponto decimal e sufixo `%` opcional.

export function normalizaEntradaPct(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".").replace("%", "").trim();
  if (limpo === "") return null;

  const valor = Number(limpo);
  if (!Number.isFinite(valor)) return null;
  if (valor < 0 || valor > 100) return null;

  return valor;
}
