import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Radix <Select> precisa destes 2 stubs em jsdom (mesmo padrão de
// objetivo-form.test.tsx/fato-gerador-form.test.tsx) -- sem eles, abrir o
// dropdown lança "scrollIntoView is not a function"/"hasPointerCapture is
// not a function".
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCaptureStub() {
    return false;
  };
}

// Spec anchor: PLV-01/PLV-08 (.specs/features/planejamento-estrategico-v2/spec.md,
// T18 de tasks.md). AD-042 integral: Governança presente em Estratégia e
// ausente em PLL, célula de % não focável, rótulos canônicos.

const PREDITORES = [
  { id_preditor: 1, nome: "Priorizam sua Agenda" },
  { id_preditor: 2, nome: "Pautam os Debates" },
];

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => {
      if (tabela === "ref_preditor") {
        return { select: () => ({ eq: () => Promise.resolve({ data: PREDITORES }) }) };
      }
      // ref_agenda_tematica
      return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
    },
  }),
}));

import { MetaForm } from "./meta-form";

const onConcluido = vi.fn();
const onCancelar = vi.fn();

const META_BASE = {
  idMeta: 12,
  idObjetivo: 1,
  descricao: "Articular apoio de 5 parlamentares para audiência pública",
  classe: "programatica" as const,
  prioridade: "media" as const,
  status: "ativa" as const,
  pctAtingimento: 35,
  idPreditorPrimario: null,
  idPreditorSecundario: null,
  idAgenda: null,
  idUsuarioResponsavel: null,
};

beforeEach(() => {
  onConcluido.mockReset();
  onCancelar.mockReset();
});

afterEach(cleanup);

describe("MetaForm — vocabulário canônico (PLV-01)", () => {
  it("o rótulo é Classe, não Tipo", () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.getByText(/^Classe/)).toBeInTheDocument();
    expect(screen.queryByText(/^Tipo/)).not.toBeInTheDocument();
  });

  it("os rótulos são Preditor primário/secundário, não Predicado", () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.getByText("Preditor primário (opcional)")).toBeInTheDocument();
    expect(screen.getByText("Preditor secundário (opcional)")).toBeInTheDocument();
    expect(screen.queryByText(/Predicado/)).not.toBeInTheDocument();
  });

  it("as opções de preditor vêm com a frase inteira do catálogo, não um resumo", async () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Preditor primário (opcional)" }));
    expect(await screen.findByRole("option", { name: "Priorizam sua Agenda" })).toBeInTheDocument();
  });

  it("Prioridade oferece Alta/Média/Baixa", async () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Prioridade (opcional)" }));
    expect(await screen.findByRole("option", { name: "Alta" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Média" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Baixa" })).toBeInTheDocument();
  });

  it("Status oferece Ativa/Pausada/Descartada, no modo editar", async () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    expect(await screen.findByRole("option", { name: "Ativa" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pausada" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Descartada" })).toBeInTheDocument();
  });
});

describe("MetaForm — Classe Governança por produto (PLM-11, PLV-01)", () => {
  it("Governança aparece na Estratégia", async () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Classe (opcional)" }));
    expect(await screen.findByRole("option", { name: "Governança" })).toBeInTheDocument();
  });

  it("Governança NÃO aparece no PLL — lado oposto", async () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="PLL" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Classe (opcional)" }));
    expect(await screen.findByRole("option", { name: "Programática" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Governança" })).not.toBeInTheDocument();
  });

  it("preditor secundário também some no PLL (mesma restrição de UI, AD-008)", () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="PLL" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.queryByText("Preditor secundário (opcional)")).not.toBeInTheDocument();
  });
});

describe("MetaForm — % de atingimento travado (PLR-10/PLV-08)", () => {
  it("só aparece no modo editar — Meta nova não tem cascata ainda", () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.queryByText("% de atingimento")).not.toBeInTheDocument();
  });

  it("mostra o valor calculado, com o marcador fx e formatação de porcentagem", () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    expect(screen.getByText("% de atingimento")).toBeInTheDocument();
    expect(screen.getByText("fx")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
  });

  it("Meta sem nenhum Sucesso Mensal ainda mostra — , não 0%", () => {
    render(
      <MetaForm
        modo={{ tipo: "editar", meta: { ...META_BASE, pctAtingimento: null } }}
        produtoNome="Estratégia"
        pessoasVinculadas={[]}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("a célula não é focável por Tab (tabIndex=-1) — não é um controle de formulário", () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    const celula = screen.getByText("35%").closest("span[aria-readonly]");
    expect(celula).toHaveAttribute("tabindex", "-1");
    expect(celula).toHaveAttribute("aria-readonly", "true");
  });

  it("a célula não tem handler de clique nem role interativo", () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    const celula = screen.getByText("35%").closest("span[aria-readonly]");
    expect(celula).not.toHaveAttribute("role", "button");
    expect(celula?.tagName).toBe("SPAN");
  });
});
