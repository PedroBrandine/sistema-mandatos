import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const updateMock = vi.fn();
const eqMock = vi.fn();
const moverItemHierarquiaMock = vi.fn();

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => {
      if (tabela === "ref_preditor") {
        return { select: () => ({ eq: () => Promise.resolve({ data: PREDITORES }) }) };
      }
      if (tabela === "ref_agenda_tematica") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      }
      // fat_meta
      return {
        update: (valores: Record<string, unknown>) => {
          updateMock(valores);
          return { eq: (coluna: string, valor: unknown) => eqMock(coluna, valor) };
        },
      };
    },
  }),
}));

vi.mock("@backend/rpc/planejamento", () => ({
  moverItemHierarquia: (...args: unknown[]) => moverItemHierarquiaMock(...args),
}));

import { MetaForm } from "./meta-form";
import { PERMISSOES } from "./permissoes";

const onConcluido = vi.fn();
const onCancelar = vi.fn();

// PLV-09 (T20). idObjetivo 1 é o Objetivo atual de META_BASE.
const OBJETIVOS = [
  { idObjetivo: 1, idPlanejamento: 1, descricao: "Consolidar liderança na pauta de educação básica", idPreditorPrimario: null, idPreditorSecundario: null, idAgenda: null, status: "ativo" as const, pctAtingimento: 60, metas: [] },
  { idObjetivo: 2, idPlanejamento: 1, descricao: "Ampliar articulação territorial no interior do estado", idPreditorPrimario: null, idPreditorSecundario: null, idAgenda: null, status: "ativo" as const, pctAtingimento: 40, metas: [] },
];

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
  updateMock.mockReset();
  eqMock.mockReset();
  moverItemHierarquiaMock.mockReset();
  eqMock.mockResolvedValue({ error: null });
  moverItemHierarquiaMock.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("MetaForm — vocabulário canônico (PLV-01)", () => {
  it("o rótulo é Classe, não Tipo", () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.getByText(/^Classe/)).toBeInTheDocument();
    expect(screen.queryByText(/^Tipo/)).not.toBeInTheDocument();
  });

  it("os rótulos são Preditor primário/secundário, não Predicado", () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.getByText("Preditor primário (opcional)")).toBeInTheDocument();
    expect(screen.getByText("Preditor secundário (opcional)")).toBeInTheDocument();
    expect(screen.queryByText(/Predicado/)).not.toBeInTheDocument();
  });

  it("as opções de preditor vêm com a frase inteira do catálogo, não um resumo", async () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Preditor primário (opcional)" }));
    expect(await screen.findByRole("option", { name: "Priorizam sua Agenda" })).toBeInTheDocument();
  });

  it("Prioridade oferece Alta/Média/Baixa", async () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Prioridade (opcional)" }));
    expect(await screen.findByRole("option", { name: "Alta" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Média" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Baixa" })).toBeInTheDocument();
  });

  it("Status oferece Ativa/Pausada/Descartada, no modo editar", async () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    expect(await screen.findByRole("option", { name: "Ativa" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pausada" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Descartada" })).toBeInTheDocument();
  });
});

describe("MetaForm — Classe Governança por produto (PLM-11, PLV-01)", () => {
  it("Governança aparece na Estratégia", async () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Classe (opcional)" }));
    expect(await screen.findByRole("option", { name: "Governança" })).toBeInTheDocument();
  });

  it("Governança NÃO aparece no PLL — lado oposto", async () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="PLL" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Classe (opcional)" }));
    expect(await screen.findByRole("option", { name: "Programática" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Governança" })).not.toBeInTheDocument();
  });

  it("preditor secundário também some no PLL (mesma restrição de UI, AD-008)", () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="PLL" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.queryByText("Preditor secundário (opcional)")).not.toBeInTheDocument();
  });
});

describe("MetaForm — % de atingimento travado (PLR-10/PLV-08)", () => {
  it("só aparece no modo editar — Meta nova não tem cascata ainda", () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.queryByText("% de atingimento")).not.toBeInTheDocument();
  });

  it("mostra o valor calculado, com o marcador fx e formatação de porcentagem", () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
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
        objetivos={[]}
        permissoes={PERMISSOES.gestora}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("a célula não é focável por Tab (tabIndex=-1) — não é um controle de formulário", () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    const celula = screen.getByText("35%").closest("span[aria-readonly]");
    expect(celula).toHaveAttribute("tabindex", "-1");
    expect(celula).toHaveAttribute("aria-readonly", "true");
  });

  it("a célula não tem handler de clique nem role interativo", () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={[]} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    const celula = screen.getByText("35%").closest("span[aria-readonly]");
    expect(celula).not.toHaveAttribute("role", "button");
    expect(celula?.tagName).toBe("SPAN");
  });
});

describe("MetaForm — Vinculação (PLV-09, T20)", () => {
  it("com moveHierarquia, mostra o select de Objetivo só no modo editar", () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    expect(screen.getByRole("combobox", { name: "Vinculação" })).toBeInTheDocument();
  });

  it("no modo criar, Vinculação não existe — mover é operação de item que já existe", () => {
    render(<MetaForm modo={{ tipo: "criar", idObjetivo: 1 }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.queryByText("Vinculação")).not.toBeInTheDocument();
  });

  it("sem moveHierarquia, o select de Objetivo some — lado oposto", () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={OBJETIVOS} permissoes={PERMISSOES.assessor} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    expect(screen.queryByText("Vinculação")).not.toBeInTheDocument();
    expect(PERMISSOES.assessor.moveHierarquia).toBe(false);
  });

  it("trocar o Objetivo e salvar chama moverItemHierarquia antes do UPDATE comum", async () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Vinculação" }));
    fireEvent.click(await screen.findByRole("option", { name: "Ampliar articulação territorial no interior do estado" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(moverItemHierarquiaMock).toHaveBeenCalledWith(expect.anything(), "meta", 12, 2));
    expect(updateMock).toHaveBeenCalled();
  });

  it("sem trocar o Objetivo, salvar NÃO chama moverItemHierarquia", async () => {
    render(
      <MetaForm modo={{ tipo: "editar", meta: META_BASE }} produtoNome="Estratégia" pessoasVinculadas={[]} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(moverItemHierarquiaMock).not.toHaveBeenCalled();
  });
});
