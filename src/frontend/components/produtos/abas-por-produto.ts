import type { ProdutoSlug } from "@backend/queries/produto";

// pll-dashboard-agenda T2 (PLL-SH-01, PLL-SH-03): extrai a lista de abas do
// hardcode que ProdutoShell tinha antes -- cada produto passa a ter seu
// próprio conjunto, em vez de assumir "as mesmas 5 abas para os 3 produtos"
// (design.md, Risks & Concerns: `produto-shell.tsx` supunha isso
// implicitamente). Estratégia e Coalizão mantêm exatamente as 5 abas de
// hoje; PLL ganha Participantes/Avaliações no lugar de Mandatos/Novo
// Contrato (D-9 -- essas duas rotas continuam existindo por URL direta,
// spec.md PLL-SH-04, só saem da barra).
//
// `href` é relativo a `/produtos/<slug>` -- quem monta a URL final é
// ProdutoShell, que já conhece o slug.
export interface AbaProduto {
  href: string;
  label: string;
}

// pll-dashboard-agenda Fix 1 (PLL-SH-01): título literal exigido pela spec
// para o cabeçalho da área do PLL -- "PROGRAMA DE LIDERANÇA PARLAMENTAR
// (PLL)" -- não existe em `ref_produto.nome` nem em `PRODUTO_SLUGS.pll.label`
// (ambos só têm "PLL", usado de propósito no hub de produtos, fora desta
// feature -- ver navegacao-por-produto/spec.md NAV-01). Este mapa é só para
// o cabeçalho de `ProdutoShell`; Estratégia/Coalizão ficam `null` porque não
// têm título longo definido em spec, então caem no comportamento de hoje
// (`produto?.nome ?? PRODUTO_SLUGS[slug].label`).
export const TITULO_AREA_PRODUTO: Record<ProdutoSlug, string | null> = {
  estrategia: null,
  coalizao: null,
  pll: "PROGRAMA DE LIDERANÇA PARLAMENTAR (PLL)",
};

export const ABAS_POR_PRODUTO: Record<ProdutoSlug, AbaProduto[]> = {
  estrategia: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/agenda", label: "Agenda" },
    { href: "/fatos-geradores", label: "Fatos Geradores" },
    { href: "/mandatos", label: "Mandatos" },
    { href: "/novo-contrato", label: "Novo Contrato" },
  ],
  coalizao: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/agenda", label: "Agenda" },
    { href: "/fatos-geradores", label: "Fatos Geradores" },
    { href: "/mandatos", label: "Mandatos" },
    { href: "/novo-contrato", label: "Novo Contrato" },
  ],
  pll: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/agenda", label: "Agenda" },
    { href: "/participantes", label: "Participantes" },
    { href: "/avaliacoes", label: "Avaliações" },
    { href: "/fatos-geradores", label: "Fatos Geradores" },
  ],
};
