import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Radix <Select> precisa destes 2 stubs em jsdom (mesmo padrão de
// objetivo-form.test.tsx/meta-form.test.tsx).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCaptureStub() {
    return false;
  };
}

// Spec anchor: PLV-04/PLV-05/PLV-06 (.specs/features/planejamento-estrategico-v2/
// spec.md, "P1: Modais completos" AC1-AC3/AC7, T19 de tasks.md). AD-042
// integral: salvar sem peso falha e com peso passa; multi só na criação e
// single na edição; % editável.

const criarSucessosEmLoteMock = vi.fn();
const moverItemHierarquiaMock = vi.fn();
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

vi.mock("@backend/rpc/planejamento", () => ({
  criarSucessosEmLote: (...args: unknown[]) => criarSucessosEmLoteMock(...args),
  moverItemHierarquia: (...args: unknown[]) => moverItemHierarquiaMock(...args),
}));

import { SucessoMensalForm } from "./sucesso-mensal-form";
import { PERMISSOES } from "./permissoes";

const onConcluido = vi.fn();
const onCancelar = vi.fn();

const PESSOAS = [
  { idUsuario: 1, nome: "Joana Martins", papelNoContrato: "assessor" },
  { idUsuario: 2, nome: "Marcos Silva", papelNoContrato: "mentor" },
];

const SUCESSO_BASE = {
  idSucesso: 21,
  idMeta: 12,
  descricao: "Mapear 10 parlamentares-alvo",
  mesReferencia: "2026-08-01",
  dtLimite: "2026-08-15",
  peso: 20,
  pctAtingimento: 60,
  status: "realizado" as const,
  diasAtraso: 0,
  estaAtrasado: false,
  idUsuarioResponsavel: null,
  atrasoDias: null,
};

const META_RESUMO_BASE = {
  descricao: "",
  classe: null,
  prioridade: null,
  status: "ativa" as const,
  pctAtingimento: null,
  idPreditorPrimario: null,
  idPreditorSecundario: null,
  idAgenda: null,
  idUsuarioResponsavel: null,
};

// PLV-09 (T20). idMeta 12 pertence ao Objetivo 1 -- é o que
// nomeObjetivoDaMeta precisa achar para derivar a leitura de Objetivo. Objetivo
// 2 existe só para provar que a grade de Vinculação oferece as Metas de TODO
// o Planejamento, não só as da Meta atual.
const OBJETIVOS = [
  {
    idObjetivo: 1,
    idPlanejamento: 1,
    descricao: "Consolidar liderança na pauta de educação básica",
    idPreditorPrimario: null,
    idPreditorSecundario: null,
    idAgenda: null,
    status: "ativo" as const,
    pctAtingimento: 60,
    metas: [{ ...META_RESUMO_BASE, idMeta: 12, idObjetivo: 1, descricao: "Articular apoio de 5 parlamentares" }],
  },
  {
    idObjetivo: 2,
    idPlanejamento: 1,
    descricao: "Ampliar articulação territorial no interior do estado",
    idPreditorPrimario: null,
    idPreditorSecundario: null,
    idAgenda: null,
    status: "ativo" as const,
    pctAtingimento: 40,
    metas: [{ ...META_RESUMO_BASE, idMeta: 30, idObjetivo: 2, descricao: "Participar de 3 fóruns nacionais" }],
  },
];

beforeEach(() => {
  criarSucessosEmLoteMock.mockReset();
  moverItemHierarquiaMock.mockReset();
  updateMock.mockReset();
  eqMock.mockReset();
  onConcluido.mockReset();
  onCancelar.mockReset();

  criarSucessosEmLoteMock.mockResolvedValue(undefined);
  moverItemHierarquiaMock.mockResolvedValue(undefined);
  eqMock.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe("SucessoMensalForm — criação: Peso obrigatório (PLV-04 AC1)", () => {
  it("sem peso, o botão de criar fica desabilitado", () => {
    render(<SucessoMensalForm modo={{ tipo: "criar", idMeta: 12 }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.change(screen.getByLabelText("Descrição do Sucesso Mensal"), { target: { value: "Nova tarefa" } });
    fireEvent.change(screen.getByLabelText("Peso (0–100)"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Criar Sucesso Mensal" })).toBeDisabled();
  });

  it("Independent Test da spec: só descrição, sem nenhum mês marcado, salvamento recusado", () => {
    // spec.md:177 -- "criar um Sucesso Mensal pelo modal informando só a
    // descrição; o salvamento é recusado citando Peso e Mês de referência".
    // Peso tem default 100 neste form; o gate que sobra de verdade é a
    // grade de meses vazia (sucessoMensalLoteSchema.meses.min(1)).
    render(<SucessoMensalForm modo={{ tipo: "criar", idMeta: 12 }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.change(screen.getByLabelText("Descrição do Sucesso Mensal"), { target: { value: "Só a descrição" } });
    expect(screen.getByRole("button", { name: "Criar Sucesso Mensal" })).toBeDisabled();
  });

  it("com peso e ao menos um mês marcado, o botão habilita e cria em lote", async () => {
    render(<SucessoMensalForm modo={{ tipo: "criar", idMeta: 12 }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.change(screen.getByLabelText("Descrição do Sucesso Mensal"), { target: { value: "Nova tarefa" } });
    const [primeiroMes] = screen.getAllByRole("checkbox");
    fireEvent.click(primeiroMes);
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Sucesso Mensal" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Sucesso Mensal" }));
    await waitFor(() => expect(criarSucessosEmLoteMock).toHaveBeenCalledTimes(1));
  });
});

describe("SucessoMensalForm — criação é sempre em lote (PLV-06)", () => {
  it("mostra a grade de meses com seleção múltipla, nunca um seletor de mês único", () => {
    render(<SucessoMensalForm modo={{ tipo: "criar", idMeta: 12 }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
    expect(screen.queryByLabelText("Mês de referência")).not.toBeInTheDocument();
  });

  it("marcar 3 meses e enviar chama criarSucessosEmLote com os 3 meses normalizados", async () => {
    render(<SucessoMensalForm modo={{ tipo: "criar", idMeta: 12 }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    fireEvent.change(screen.getByLabelText("Descrição do Sucesso Mensal"), { target: { value: "Reunião mensal" } });
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar Sucesso Mensal" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Criar Sucesso Mensal" }));
    await waitFor(() => expect(criarSucessosEmLoteMock).toHaveBeenCalledTimes(1));
    const [, , , meses] = criarSucessosEmLoteMock.mock.calls[0];
    expect(meses).toHaveLength(3);
  });

  it("% de atingimento não aparece na criação — nasce sem medição (AD-005)", () => {
    render(<SucessoMensalForm modo={{ tipo: "criar", idMeta: 12 }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.queryByLabelText("% de atingimento")).not.toBeInTheDocument();
  });
});

describe("SucessoMensalForm — edição: um mês só, nunca a grade (PLV-06 AC4)", () => {
  it("mostra o seletor de um mês, nunca a grade de múltipla escolha", () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    expect(screen.getByLabelText("Mês de referência")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Atribuição de meses/)).not.toBeInTheDocument();
  });

  it("salvar chama UPDATE pelo id, não a RPC de lote", async () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(eqMock).toHaveBeenCalledWith("id_sucesso", 21));
    expect(criarSucessosEmLoteMock).not.toHaveBeenCalled();
  });
});

describe("SucessoMensalForm — % de atingimento editável na edição (PLV-05 AC7)", () => {
  it("o campo existe e é um input numérico de verdade, não uma célula travada", () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    const campo = screen.getByLabelText("% de atingimento");
    expect(campo).toBeInTheDocument();
    expect(campo.tagName).toBe("INPUT");
    expect(campo).not.toHaveAttribute("tabindex", "-1");
    expect(campo).not.toHaveAttribute("readonly");
  });

  it("mostra o valor atual e permite editar", () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    const campo = screen.getByLabelText("% de atingimento") as HTMLInputElement;
    expect(campo.value).toBe("60");
    fireEvent.change(campo, { target: { value: "80" } });
    expect(campo.value).toBe("80");
  });

  it("limpar o campo grava null, não 0 (AD-005)", async () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    fireEvent.change(screen.getByLabelText("% de atingimento"), { target: { value: "" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(updateMock.mock.calls[0][0]).toMatchObject({ pct_atingimento: null });
  });
});

describe("SucessoMensalForm — Responsável (PLV-03)", () => {
  it("aparece na criação e na edição, com placeholder de herança da Meta", () => {
    render(<SucessoMensalForm modo={{ tipo: "criar", idMeta: 12 }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />);
    expect(screen.getByRole("combobox", { name: "Responsável (opcional)" })).toHaveTextContent("Herda o da Meta");
  });

  it("oferece só pessoas com vínculo ativo no contrato", async () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Responsável (opcional)" }));
    expect(await screen.findByRole("option", { name: "Joana Martins (assessor)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Marcos Silva (mentor)" })).toBeInTheDocument();
  });
});

describe("SucessoMensalForm — Status (PLV-06)", () => {
  it("oferece Pendente/Realizado/Não realizado na edição", async () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    expect(await screen.findByRole("option", { name: "Pendente" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Realizado" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Não realizado" })).toBeInTheDocument();
  });
});

describe("SucessoMensalForm — Vinculação (PLV-09, T20)", () => {
  it("com moveHierarquia, mostra o select de Meta e o Objetivo derivado em leitura", () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    expect(screen.getByRole("combobox", { name: "Vinculação — Meta" })).toBeInTheDocument();
    expect(screen.getByText("Consolidar liderança na pauta de educação básica")).toBeInTheDocument();
  });

  it("o Objetivo NUNCA é um combobox — é texto, mesmo com a Vinculação visível", () => {
    // AC3, regra inegociável: sugerir um select de Objetivo diria que dá para
    // pendurar o SM direto nele, o que a FK não permite.
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    expect(screen.getAllByRole("combobox")).toHaveLength(3); // Vinculação, Responsável, Status
    expect(screen.queryByRole("combobox", { name: /Objetivo/ })).not.toBeInTheDocument();
  });

  it("trocar a Meta na Vinculação atualiza o Objetivo mostrado — é derivado, não fixo", async () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    expect(screen.getByText("Consolidar liderança na pauta de educação básica")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Vinculação — Meta" }));
    fireEvent.click(await screen.findByRole("option", { name: "Participar de 3 fóruns nacionais" }));
    expect(screen.getByText("Ampliar articulação territorial no interior do estado")).toBeInTheDocument();
    expect(screen.queryByText("Consolidar liderança na pauta de educação básica")).not.toBeInTheDocument();
  });

  it("trocar de Meta e salvar chama moverItemHierarquia antes do UPDATE comum", async () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Vinculação — Meta" }));
    fireEvent.click(await screen.findByRole("option", { name: "Participar de 3 fóruns nacionais" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(moverItemHierarquiaMock).toHaveBeenCalledWith(expect.anything(), "sucesso", 21, 30));
    expect(updateMock).toHaveBeenCalled();
  });

  it("sem trocar a Meta, salvar NÃO chama moverItemHierarquia", async () => {
    render(
      <SucessoMensalForm modo={{ tipo: "editar", sucesso: SUCESSO_BASE }} pessoasVinculadas={PESSOAS} objetivos={OBJETIVOS} permissoes={PERMISSOES.gestora} onConcluido={onConcluido} onCancelar={onCancelar} />
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    expect(moverItemHierarquiaMock).not.toHaveBeenCalled();
  });

  it("sem moveHierarquia, os controles de Vinculação somem por completo — lado oposto", () => {
    render(
      <SucessoMensalForm
        modo={{ tipo: "editar", sucesso: SUCESSO_BASE }}
        pessoasVinculadas={PESSOAS}
        objetivos={OBJETIVOS}
        permissoes={PERMISSOES.assessor}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );
    expect(screen.queryByRole("combobox", { name: "Vinculação — Meta" })).not.toBeInTheDocument();
    expect(screen.queryByText("Consolidar liderança na pauta de educação básica")).not.toBeInTheDocument();
    expect(PERMISSOES.assessor.moveHierarquia).toBe(false);
  });
});
