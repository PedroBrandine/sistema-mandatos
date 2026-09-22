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

// PF-02 (T8) + correção de 2026-09-22 (.specs/STATE.md): a Situação do
// Sucesso Mensal é sempre DERIVADA do % de atingimento, nunca digitada.
// Migration 20260922151933 espelha esta mesma regra num trigger de banco
// (fat_sucesso_mensal), que é quem garante o valor final -- esta função serve
// só para a UI mostrar o mesmo resultado otimisticamente, sem esperar o
// round-trip. As duas precisam concordar bit a bit.
export function derivaSituacao(pctAtingimento: number | null | undefined): "pendente" | "realizado" | "nao_realizado" {
  if (pctAtingimento != null && pctAtingimento >= 100) return "realizado";
  return "pendente";
}
