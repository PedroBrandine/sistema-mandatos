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

vi.mock("@/hooks/use-produto-atual", () => ({
  useProdutoAtual: () => ({ data: { idProduto: 1, nome: "Estratégia" } }),
}));

import { ProdutoShell } from "./produto-shell";

beforeEach(() => {
  pathnameAtual = "/produtos/estrategia/dashboard";
});

afterEach(cleanup);

describe("ProdutoShell (EST-03)", () => {
  it("renderiza titulo e as 4 abas com 'Mandatos' no lugar de 'Contratos' (AC1)", () => {
    render(<ProdutoShell slug="estrategia">{null}</ProdutoShell>);

    expect(screen.getByRole("heading", { name: "Estratégia" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mandatos" })).toHaveAttribute(
      "href",
      "/produtos/estrategia/mandatos"
    );
    expect(screen.getByRole("link", { name: "Novo Contrato" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Contratos" })).not.toBeInTheDocument();
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
