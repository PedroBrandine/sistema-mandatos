import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: redesenho-estrategia-tela-first / EST-03 (T13, AD-046 -- tela
// de leitura). "Voltar ao hub" e a marcação de aba ativa são condicionais
// que o próprio Done-when pede "dos dois lados" -- os demais critérios
// seguem caminho feliz único.
//
// AC4 ("slug inválido retorna 404") não é retestada aqui: ProdutoShell só
// recebe um `slug: ProdutoSlug` já estreitado pelo tipo -- a fronteira de
// validação real é `produtos/[slug]/layout.tsx` (notFound()), arquivo que
// esta task não toca (design.md: "única fronteira de validação").
let pathnameAtual = "/produtos/estrategia/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameAtual,
}));

// Fix 1 (PLL-SH-01): dinâmico por slug para poder testar o título de
// Estratégia/Coalizão em regressão sem quebrar o fallback `produto?.nome`
// que ProdutoShell usa quando TITULO_AREA_PRODUTO[slug] é null.
vi.mock("@/hooks/use-produto-atual", () => ({
  useProdutoAtual: (slug: string) => ({
    data: { idProduto: 1, nome: slug === "coalizao" ? "Coalizão" : slug === "pll" ? "PLL" : "Estratégia" },
  }),
}));

import { ProdutoShell } from "./produto-shell";

beforeEach(() => {
  pathnameAtual = "/produtos/estrategia/dashboard";
});

afterEach(cleanup);

describe("ProdutoShell (EST-03)", () => {
  it("renderiza titulo e as 5 abas com 'Mandatos' no lugar de 'Contratos' (AC1)", () => {
    render(<ProdutoShell slug="estrategia">{null}</ProdutoShell>);

    expect(screen.getByRole("heading", { name: "Estratégia" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fatos Geradores" })).toHaveAttribute(
      "href",
      "/produtos/estrategia/fatos-geradores"
    );
    expect(screen.getByRole("link", { name: "Mandatos" })).toHaveAttribute(
      "href",
      "/produtos/estrategia/mandatos"
    );
    expect(screen.getByRole("link", { name: "Novo Contrato" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Contratos" })).not.toBeInTheDocument();
  });

  it("Fatos Geradores fica entre Agenda e Mandatos", () => {
    render(<ProdutoShell slug="estrategia">{null}</ProdutoShell>);

    const ordem = screen.getAllByRole("link").map((l) => l.textContent);
    const agenda = ordem.indexOf("Agenda");
    expect(ordem.slice(agenda, agenda + 3)).toEqual(["Agenda", "Fatos Geradores", "Mandatos"]);
  });

  it("marca a aba ativa e deixa as demais sem marcação (AC2, dois lados)", () => {
    pathnameAtual = "/produtos/estrategia/mandatos";
    render(<ProdutoShell slug="estrategia">{null}</ProdutoShell>);

    // Ajuste de fidelidade visual, 2026-09-14 (Figma 44:20/44:21): aba ativa
    // em secondary (vinho), não primary (teal) -- ver route-tabs.tsx.
    expect(screen.getByRole("link", { name: "Mandatos" })).toHaveClass("text-secondary");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveClass("text-secondary");
  });

  it("'Voltar ao hub' navega para '/' (AC3)", () => {
    render(<ProdutoShell slug="estrategia">{null}</ProdutoShell>);

    expect(screen.getByRole("link", { name: /voltar ao hub/i })).toHaveAttribute("href", "/");
  });
});

describe("ProdutoShell + ABAS_POR_PRODUTO (pll-dashboard-agenda T2, PLL-SH-01/PLL-SH-03)", () => {
  it("regressão: Coalizão continua com as mesmas 5 abas de hoje, na mesma ordem", () => {
    render(<ProdutoShell slug="coalizao">{null}</ProdutoShell>);

    const ordem = screen.getAllByRole("link").map((l) => l.textContent);
    expect(ordem).toEqual(["Voltar ao hub", "Dashboard", "Agenda", "Fatos Geradores", "Mandatos", "Novo Contrato"]);
    expect(screen.getByRole("link", { name: "Mandatos" })).toHaveAttribute(
      "href",
      "/produtos/coalizao/mandatos"
    );
  });

  it("PLL-SH-01: PLL mostra Dashboard, Agenda, Participantes, Avaliações, Fatos Geradores, nesta ordem", () => {
    render(<ProdutoShell slug="pll">{null}</ProdutoShell>);

    const ordem = screen.getAllByRole("link").map((l) => l.textContent);
    expect(ordem).toEqual([
      "Voltar ao hub",
      "Dashboard",
      "Agenda",
      "Participantes",
      "Avaliações",
      "Fatos Geradores",
    ]);
    expect(screen.queryByRole("link", { name: "Mandatos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Novo Contrato" })).not.toBeInTheDocument();
  });

  it("PLL-SH-01 (Fix 1): título da área do PLL é o nome por extenso, não 'PLL'", () => {
    render(<ProdutoShell slug="pll">{null}</ProdutoShell>);

    expect(
      screen.getByRole("heading", { name: "PROGRAMA DE LIDERANÇA PARLAMENTAR (PLL)" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "PLL" })).not.toBeInTheDocument();
  });

  it("PLL-SH-01 (Fix 1, regressão): Estratégia e Coalizão continuam com o título de hoje", () => {
    render(<ProdutoShell slug="estrategia">{null}</ProdutoShell>);
    expect(screen.getByRole("heading", { name: "Estratégia" })).toBeInTheDocument();
    cleanup();

    render(<ProdutoShell slug="coalizao">{null}</ProdutoShell>);
    expect(screen.getByRole("heading", { name: "Coalizão" })).toBeInTheDocument();
  });

  it("PLL-SH-01: cada aba do PLL aponta para /produtos/pll/<rota>", () => {
    render(<ProdutoShell slug="pll">{null}</ProdutoShell>);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/produtos/pll/dashboard");
    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/produtos/pll/agenda");
    expect(screen.getByRole("link", { name: "Participantes" })).toHaveAttribute(
      "href",
      "/produtos/pll/participantes"
    );
    expect(screen.getByRole("link", { name: "Avaliações" })).toHaveAttribute("href", "/produtos/pll/avaliacoes");
    expect(screen.getByRole("link", { name: "Fatos Geradores" })).toHaveAttribute(
      "href",
      "/produtos/pll/fatos-geradores"
    );
  });
});
