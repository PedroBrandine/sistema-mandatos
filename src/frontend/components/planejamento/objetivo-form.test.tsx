import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Radix <Select> precisa destes 2 stubs em jsdom (mesmo padrão de
// fato-gerador-form.test.tsx/mandato-wizard.test.tsx) -- sem eles, abrir o
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

// Spec anchor: PLV-02/PLV-07 (.specs/features/planejamento-estrategico-v2/spec.md,
// "P1: Status no Objetivo Específico" e T17 de tasks.md). AD-042 integral: os dois
// lados do gate do secundário, status renderizado, ausência de SWOT.
//
// Preditor/Agenda FICAM no modal por decisão de Pedro (2026-09-16, ver
// comentário de cabeçalho de objetivo-form.tsx) mesmo o Figma 271:808 não os
// desenhando -- a grade exibe esses campos na linha do Objetivo, e tirá-los
// daqui deixaria valor em tela sem caminho de edição.

const PREDITORES = [
  { id_preditor: 1, nome: "Priorizam sua Agenda" },
  { id_preditor: 2, nome: "Pautam os Debates" },
];

let agendasMock: { id_agenda: number; nome: string }[] = [];

const insertMock = vi.fn();
const updateMock = vi.fn();
const eqUpdateMock = vi.fn();

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => {
      if (tabela === "ref_preditor") {
        return { select: () => ({ eq: () => Promise.resolve({ data: PREDITORES }) }) };
      }
      if (tabela === "ref_agenda_tematica") {
        return { select: () => ({ eq: () => Promise.resolve({ data: agendasMock }) }) };
      }
      // fat_objetivo_especifico
      return {
        insert: (valores: Record<string, unknown>) => ({
          select: () => ({
            single: () => insertMock(valores),
          }),
        }),
        update: (valores: Record<string, unknown>) => {
          updateMock(valores);
          return { eq: (coluna: string, valor: unknown) => eqUpdateMock(coluna, valor) };
        },
      };
    },
  }),
}));

import { ObjetivoForm } from "./objetivo-form";

const onConcluido = vi.fn();
const onCancelar = vi.fn();

const OBJETIVO_BASE = {
  idObjetivo: 5,
  idPlanejamento: 1,
  descricao: "Consolidar liderança na pauta de educação básica",
  idPreditorPrimario: null,
  idPreditorSecundario: null,
  idAgenda: null,
  status: "ativo" as const,
  pctAtingimento: 40,
  metas: [],
};

beforeEach(() => {
  agendasMock = [];
  insertMock.mockReset();
  updateMock.mockReset();
  eqUpdateMock.mockReset();
  onConcluido.mockReset();
  onCancelar.mockReset();

  insertMock.mockResolvedValue({ data: { id_objetivo: 99 }, error: null });
  eqUpdateMock.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe("ObjetivoForm — Status (PLV-02)", () => {
  it("mostra os 3 valores do status", async () => {
    render(<ObjetivoForm modo={{ tipo: "editar", objetivo: OBJETIVO_BASE }} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    expect(await screen.findByRole("option", { name: "Ativo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pausado" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Descartado" })).toBeInTheDocument();
  });

  it("editar um Objetivo pausado mantém 'pausado' no payload, não o devolve a 'ativo'", async () => {
    // A falha que este teste mata: payload sem `status`, que devolvia a coluna
    // ao valor antigo em silêncio (comentário em enviar()).
    render(
      <ObjetivoForm
        modo={{ tipo: "editar", objetivo: { ...OBJETIVO_BASE, status: "pausado" } }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock.mock.calls[0][0]).toMatchObject({ status: "pausado" });
  });

  it("criar um Objetivo novo manda status 'ativo' por padrão", async () => {
    render(<ObjetivoForm modo={{ tipo: "criar", idPlanejamento: 1 }} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.change(screen.getByLabelText("Descrição do Objetivo"), { target: { value: "Novo objetivo" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Objetivo" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Objetivo" }));
    await waitFor(() => expect(insertMock).toHaveBeenCalled());
  });
});

describe("ObjetivoForm — gate do preditor secundário (ck_objetivo_preditores)", () => {
  it("sem primário escolhido, o secundário fica desabilitado", () => {
    render(<ObjetivoForm modo={{ tipo: "criar", idPlanejamento: 1 }} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.getByRole("combobox", { name: "Preditor secundário (opcional)" })).toBeDisabled();
  });

  it("com primário escolhido, o secundário fica habilitado", async () => {
    render(<ObjetivoForm modo={{ tipo: "criar", idPlanejamento: 1 }} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Preditor primário (opcional)" }));
    fireEvent.click(await screen.findByRole("option", { name: "Priorizam sua Agenda" }));
    expect(screen.getByRole("combobox", { name: "Preditor secundário (opcional)" })).not.toBeDisabled();
  });

  it("o secundário não oferece a opção já escolhida como primário", async () => {
    render(<ObjetivoForm modo={{ tipo: "criar", idPlanejamento: 1 }} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Preditor primário (opcional)" }));
    fireEvent.click(await screen.findByRole("option", { name: "Priorizam sua Agenda" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Preditor secundário (opcional)" }));
    expect(screen.queryByRole("option", { name: "Priorizam sua Agenda" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pautam os Debates" })).toBeInTheDocument();
  });

  it("trocar o primário para o valor do secundário limpa o secundário", async () => {
    // Sem isso, o payload chegaria com primário === secundário, violando
    // ck_objetivo_preditores em silêncio até o submit.
    render(
      <ObjetivoForm
        modo={{
          tipo: "editar",
          objetivo: { ...OBJETIVO_BASE, idPreditorPrimario: 1, idPreditorSecundario: 2 },
        }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );
    // Catálogo de preditores chega por fetch assíncrono (useEffect) -- o nome
    // só aparece depois que a promise resolve.
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Preditor secundário (opcional)" })).toHaveTextContent(
        "Pautam os Debates"
      )
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Preditor primário (opcional)" }));
    fireEvent.click(await screen.findByRole("option", { name: "Pautam os Debates" }));
    expect(screen.getByRole("combobox", { name: "Preditor secundário (opcional)" })).toHaveTextContent("Nenhum");
  });
});

describe("ObjetivoForm — Agenda temática (CAT-16)", () => {
  it("catálogo vazio marca o rótulo como pendente, sem valor de exemplo", () => {
    agendasMock = [];
    render(<ObjetivoForm modo={{ tipo: "criar", idPlanejamento: 1 }} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.getByText(/Agenda temática \(catálogo pendente\)/)).toBeInTheDocument();
  });

  it("catálogo com conteúdo aprovado não mostra o aviso de pendência", async () => {
    agendasMock = [{ id_agenda: 1, nome: "Educação e Primeira Infância" }];
    render(<ObjetivoForm modo={{ tipo: "criar", idPlanejamento: 1 }} onConcluido={onConcluido} onCancelar={onCancelar} />);
    // O rótulo nasce marcado como pendente (agendas ainda não chegou do fetch) e
    // só perde a marca depois que o catálogo resolve -- daí o waitFor, não uma
    // asserção síncrona.
    await waitFor(() => expect(screen.queryByText(/catálogo pendente/)).not.toBeInTheDocument());
  });
});

describe("ObjetivoForm — sem SWOT (AD-049)", () => {
  it("não existe campo de Oportunidade nem de Ameaça", () => {
    render(<ObjetivoForm modo={{ tipo: "criar", idPlanejamento: 1 }} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.queryByLabelText(/oportunidade/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ameaça/i)).not.toBeInTheDocument();
  });

  it("o payload de criação não carrega oportunidade nem ameaça", async () => {
    render(<ObjetivoForm modo={{ tipo: "criar", idPlanejamento: 1 }} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.change(screen.getByLabelText("Descrição do Objetivo"), { target: { value: "Novo objetivo" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Objetivo" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Objetivo" }));
    await waitFor(() => expect(insertMock).toHaveBeenCalled());
    const payload = insertMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty("oportunidade");
    expect(payload).not.toHaveProperty("ameaca");
  });
});
