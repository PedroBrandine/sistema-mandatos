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
