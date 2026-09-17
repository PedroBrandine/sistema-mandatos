import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Radix <Select> precisa destes 2 stubs em jsdom (mesmo padrão de
// mandato-wizard.test.tsx) -- sem eles, abrir o dropdown lança
// "scrollIntoView is not a function"/"hasPointerCapture is not a function".
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCaptureStub() {
    return false;
  };
}

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P1:
// Registrar Fato Gerador pelo wizard" AC5, AC8, AC9, AC10, AC11 -- Título
// obrigatório, régua de 4 posições sem legenda descritiva, Data de
// ocorrência/prevista alternando por situação. AD-042 integral: os dois
// lados de cada condicional. Skill figma-dominio-legisla: régua NUNCA com 5
// posições, dimensões D1/D2/D3 sem nome descritivo -- reincidência
// catalogada, cobrimos com teste explícito.

const criarFatoGeradorMock = vi.fn();

vi.mock("@backend/rpc/fato-gerador", () => ({
  criarFatoGerador: (...args: unknown[]) => criarFatoGeradorMock(...args),
}));

const TIPOLOGIAS = [
  {
    idTipologia: 5,
    grupo: "2. Produção Legislativa",
    tipologia: "Projeto de lei / proposição",
    estado: "Em tramitação ativa",
    nivelD1Padrao: "baixo",
    nivelD2Padrao: "medio",
    nivelD3Padrao: "medio",
    idPreditor1: 1,
    idPreditor2: null,
    nomePreditor1: "Constroem Partido",
    nomePreditor2: null,
  },
];

const NIVEIS = [
  { codigo: "baixo", rotulo: "Baixo" },
  { codigo: "medio", rotulo: "Médio" },
  { codigo: "alto", rotulo: "Alto" },
  { codigo: "maximo", rotulo: "Máximo" },
];

const buscarTipologiasCompletasMock = vi.fn();
const buscarNiveisIipMock = vi.fn();

vi.mock("@backend/queries/incidencia", () => ({
  buscarTipologiasCompletas: (...args: unknown[]) => buscarTipologiasCompletasMock(...args),
  buscarNiveisIip: (...args: unknown[]) => buscarNiveisIipMock(...args),
}));

const updateMock = vi.fn();
const eqMock = vi.fn();

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      update: (valores: Record<string, unknown>) => {
        updateMock(valores);
        return { eq: (coluna: string, valor: unknown) => eqMock(coluna, valor) };
      },
    }),
  }),
}));

import { FatoGeradorForm } from "./fato-gerador-form";

beforeEach(() => {
  criarFatoGeradorMock.mockReset();
  buscarTipologiasCompletasMock.mockReset();
  buscarNiveisIipMock.mockReset();
  updateMock.mockReset();
  eqMock.mockReset();
  buscarTipologiasCompletasMock.mockResolvedValue(TIPOLOGIAS);
  buscarNiveisIipMock.mockResolvedValue(NIVEIS);
  criarFatoGeradorMock.mockResolvedValue({ idFatoGerador: 99 });
  eqMock.mockResolvedValue({ error: null });
});

afterEach(cleanup);

// Grupo/Tipologia/Estado não passam por <FormField>/<FormControl> (são
// estado de UI da cascata, só id_tipologia é campo do schema -- ver
// fato-gerador-form.tsx), então o <FormLabel> não fica associado ao
// <SelectTrigger> por htmlFor. Localizamos os 3 comboboxes pela ordem de
// renderização (Grupo, Tipologia, Estado), mesmo padrão do combobox Radix
// (role="combobox") usado em mandato-wizard.test.tsx.
async function escolherTripla() {
  const [comboGrupo] = screen.getAllByRole("combobox");
  fireEvent.click(comboGrupo);
  fireEvent.click(await screen.findByRole("option", { name: "2. Produção Legislativa" }));

  const [, comboTipologia] = screen.getAllByRole("combobox");
  fireEvent.click(comboTipologia);
  fireEvent.click(await screen.findByRole("option", { name: "Projeto de lei / proposição" }));

  const [, , comboEstado] = screen.getAllByRole("combobox");
  fireEvent.click(comboEstado);
  fireEvent.click(await screen.findByRole("option", { name: "Em tramitação ativa" }));
}

const onConcluido = vi.fn();
const onCancelar = vi.fn();

beforeEach(() => {
  onConcluido.mockReset();
  onCancelar.mockReset();
});

describe("FatoGeradorForm — Título obrigatório (spec.md P1 AC5)", () => {
  it("sem título, o botão de criar fica desabilitado", async () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        origemInicial={{ tipo: "sem_origem" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    await escolherTripla();
    fireEvent.change(screen.getByLabelText("Data de ocorrência"), { target: { value: "2026-09-10" } });

    expect(screen.getByRole("button", { name: "Criar Fato Gerador" })).toBeDisabled();
  });

  it("com título preenchido (e resto válido), o botão habilita -- lado oposto", async () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        origemInicial={{ tipo: "sem_origem" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    await escolherTripla();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Aprovação do projeto X" } });
    fireEvent.change(screen.getByLabelText("Data de ocorrência"), { target: { value: "2026-09-10" } });

    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Fato Gerador" })).toBeEnabled());
  });
});

describe("FatoGeradorForm — régua de níveis com 4 posições, sem legenda (regressão catalogada)", () => {
  it("exibe Nível D1/D2/D3 sem nome descritivo, com os rótulos da tripla escolhida", async () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        origemInicial={{ tipo: "sem_origem" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    await escolherTripla();

    expect(await screen.findByText("Nível D1:")).toBeInTheDocument();
    expect(screen.getByText("Nível D2:")).toBeInTheDocument();
    expect(screen.getByText("Nível D3:")).toBeInTheDocument();
    // Nenhuma legenda descritiva inventada (ex.: "Grau de Impacto",
    // "Urgência Política") -- a reincidência catalogada em
    // figma-dominio-legisla.
    expect(screen.queryByText(/Grau de Impacto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Urgência Política/i)).not.toBeInTheDocument();
  });

  it("os 4 (e só 4) rótulos de nível existem no catálogo carregado -- nunca um 5º", async () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        origemInicial={{ tipo: "sem_origem" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    await escolherTripla();
    await screen.findByText("Nível D1:");

    expect(NIVEIS).toHaveLength(4);
    expect(NIVEIS.map((n) => n.rotulo)).toEqual(["Baixo", "Médio", "Alto", "Máximo"]);
    expect(screen.queryByText(/Nível 5/i)).not.toBeInTheDocument();
  });

  it("níveis batem com o seed da tripla escolhida: Baixo / Médio / Médio", async () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        origemInicial={{ tipo: "sem_origem" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    await escolherTripla();

    const bloco = (await screen.findByText("Nível D1:")).closest("div");
    expect(bloco).toHaveTextContent("Nível D1: Baixo");
    expect(bloco).toHaveTextContent("Nível D2: Médio");
    expect(bloco).toHaveTextContent("Nível D3: Médio");
  });
});

describe("FatoGeradorForm — situação alterna Data de ocorrência / Data prevista (AC10/AC11)", () => {
  it("realizado: pede Data de ocorrência e NÃO pede Data prevista", () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        origemInicial={{ tipo: "sem_origem" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    expect(screen.getByLabelText("Data de ocorrência")).toBeInTheDocument();
    expect(screen.queryByLabelText("Data prevista")).not.toBeInTheDocument();
  });

  it("projetado: pede Data prevista e NÃO pede Data de ocorrência -- lado oposto", () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="projetado"
        origemInicial={{ tipo: "sem_origem" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    expect(screen.getByLabelText("Data prevista")).toBeInTheDocument();
    expect(screen.queryByLabelText("Data de ocorrência")).not.toBeInTheDocument();
  });
});

describe("FatoGeradorForm — origem do passo 1 (somente leitura, não duplica escolha)", () => {
  it("exibe a origem escolhida no wizard, sem Select para reescolher", async () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        origemInicial={{ tipo: "insight", id: 12, rotulo: "Insight sobre saúde" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    expect(screen.getByText("Origem: Insight: Insight sobre saúde")).toBeInTheDocument();
    expect(screen.queryByLabelText("Meta de origem (opcional)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Insight de origem (opcional)")).not.toBeInTheDocument();
  });

  it("sem origem mostra 'Sem origem', não um erro -- lado oposto", () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        origemInicial={{ tipo: "sem_origem" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    expect(screen.getByText("Origem: Sem origem")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("FatoGeradorForm — submissão envia os campos novos ao RPC", () => {
  it("envia titulo/situacao/dt_prevista e o id da origem escolhida", async () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="projetado"
        origemInicial={{ tipo: "registro", id: 55, rotulo: "Reunião" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    await escolherTripla();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Projeção de votação" } });
    fireEvent.change(screen.getByLabelText("Data prevista"), { target: { value: "2026-10-01" } });

    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Fato Gerador" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Fato Gerador" }));

    await waitFor(() => expect(criarFatoGeradorMock).toHaveBeenCalledTimes(1));
    const [, payload] = criarFatoGeradorMock.mock.calls[0];
    expect(payload).toMatchObject({
      titulo: "Projeção de votação",
      situacao: "projetado",
      dtPrevista: "2026-10-01",
      dtOcorrencia: null,
      idRegistroOrigem: 55,
      idMetaOrigem: null,
      idInsightOrigem: null,
      idPreInsightOrigem: null,
    });
    expect(onConcluido).toHaveBeenCalledWith({ idFatoGerador: 99 });
  });

  it("falha do RPC exibe ErroInline (L-008)", async () => {
    criarFatoGeradorMock.mockRejectedValue(new Error("RLS negou a escrita."));

    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        origemInicial={{ tipo: "sem_origem" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    await escolherTripla();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Aprovação" } });
    fireEvent.change(screen.getByLabelText("Data de ocorrência"), { target: { value: "2026-09-10" } });

    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Fato Gerador" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Fato Gerador" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("RLS negou a escrita.");
    expect(onConcluido).not.toHaveBeenCalled();
  });
});

describe("FatoGeradorForm — edição (fix pós-Verifier, spec.md 'aba como casa única' AC2)", () => {
  const FATO_EXISTENTE = {
    idFatoGerador: 42,
    idTipologia: 5,
    titulo: "Aprovação antiga",
    contribuicaoLegisla: 3,
    descricaoEvidencia: "Evidência antiga",
    dtOcorrencia: "2026-08-01",
    dtPrevista: null,
  };

  it("popula título, tripla derivada e data a partir do fato existente, sem bloco de Origem", async () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        fatoGeradorExistente={FATO_EXISTENTE}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    expect(await screen.findByDisplayValue("Aprovação antiga")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-08-01")).toBeInTheDocument();
    // Tripla derivada da tipologia existente (id 5 = "2. Produção
    // Legislativa"), mesma régua sem legenda descritiva.
    const bloco = (await screen.findByText("Nível D1:", {}, { timeout: 3000 })).closest("div");
    expect(bloco).toHaveTextContent("Nível D1: Baixo");
    // Sem origem no wizard -- edição não reabre origem.
    expect(screen.queryByText(/^Origem:/)).not.toBeInTheDocument();
  });

  it("salvar chama UPDATE pelo id, não o RPC de criação -- lado oposto", async () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        fatoGeradorExistente={FATO_EXISTENTE}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(eqMock).toHaveBeenCalledWith("id_fato_gerador", 42);
    expect(updateMock.mock.calls[0][0]).toMatchObject({ titulo: "Aprovação antiga", id_tipologia: 5 });
    expect(criarFatoGeradorMock).not.toHaveBeenCalled();
    expect(onConcluido).toHaveBeenCalledWith();
  });

  it("falha do UPDATE mostra ErroInline e não conclui -- lado oposto do sucesso", async () => {
    eqMock.mockResolvedValue({ error: { message: "RLS negou a escrita." } });

    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        fatoGeradorExistente={FATO_EXISTENTE}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("RLS negou a escrita.");
    expect(onConcluido).not.toHaveBeenCalled();
  });
});

describe("FatoGeradorForm — Cancelar", () => {
  it("aciona onCancelar", () => {
    render(
      <FatoGeradorForm
        idContrato={7}
        situacaoInicial="realizado"
        origemInicial={{ tipo: "sem_origem" }}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });
});
