import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom não implementa scrollIntoView/hasPointerCapture, e o Select do Radix
// os chama ao abrir -- mesmo stub de objetivo-form.test.tsx/insight-form.test.tsx.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCaptureStub() {
    return false;
  };
}

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P2: Agenda na
// ficha e Novo Agendamento" AC2/AC4/AC5/AC6 (FMC-30, FMC-31, FMC-32).
// tasks.md T38 Done-when:
//  - Etapa lista só ref_etapa do produto; escolher Etapa filtra os Tipos
//    daquela etapa -- os dois lados
//  - Modalidade Presencial mostra Local; Online esconde -- os dois lados
//  - Participante externo grava nome_livre + origem='externo'; usuário grava
//    id_usuario
//  - Erro do RPC renderiza <ErroInline>
//
// AD-042 integral: cada condicional citada acima tem os dois lados testados.
// Interação com <Select> segue o mesmo padrão comprovado de objetivo-form.test.tsx:
// abrir pelo combobox (accessible name = Label associado) e escolher pelo
// role "option", nunca por texto solto (que cai fora da árvore de acessibilidade
// quando o Portal do Radix mede layout que o jsdom não simula).

const criarEncontroMock = vi.fn();
vi.mock("@backend/rpc/encontro", async () => {
  const real = await vi.importActual<typeof import("@backend/rpc/encontro")>("@backend/rpc/encontro");
  return { ...real, criarEncontro: (...args: unknown[]) => criarEncontroMock(...args) };
});

const buscarContratoParaFichaMock = vi.fn();
const buscarEtapasDoProdutoMock = vi.fn();
vi.mock("@backend/queries/contrato", async () => {
  const real = await vi.importActual<typeof import("@backend/queries/contrato")>("@backend/queries/contrato");
  return {
    ...real,
    buscarContratoParaFicha: (...args: unknown[]) => buscarContratoParaFichaMock(...args),
    buscarEtapasDoProduto: (...args: unknown[]) => buscarEtapasDoProdutoMock(...args),
  };
});

// Fake client encadeável, só para as duas leituras inline desta task:
// ref_tipo_registro (filtrada por id_etapa) e dim_usuario (lista simples).
// `then` resolve como o postgrest-js resolve (thenable direto na query, sem
// `await` explícito no código de produção).
const TIPOS_POR_ETAPA: Record<number, { id_tipo_registro: number; nome: string }[]> = {
  9: [{ id_tipo_registro: 61, nome: "Pontapé" }],
  10: [{ id_tipo_registro: 62, nome: "Sprint" }],
};
const USUARIOS = [{ id_usuario: 5, nome: "Ana Gestora" }];

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({
    from: (tabela: string) => {
      if (tabela === "ref_tipo_registro") {
        let idEtapaFiltro: number | undefined;
        const builder = {
          select: () => builder,
          eq: (coluna: string, valor: unknown) => {
            if (coluna === "id_etapa") idEtapaFiltro = valor as number;
            return builder;
          },
          then: (resolve: (v: { data: unknown }) => void) =>
            resolve({ data: idEtapaFiltro !== undefined ? (TIPOS_POR_ETAPA[idEtapaFiltro] ?? []) : [] }),
        };
        return builder;
      }
      if (tabela === "dim_usuario") {
        const builder = {
          select: () => builder,
          order: () => builder,
          then: (resolve: (v: { data: unknown }) => void) => resolve({ data: USUARIOS }),
        };
        return builder;
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
    },
  }),
}));

import { EncontroForm } from "./encontro-form";

afterEach(cleanup);

const onConcluido = vi.fn();
const onCancelar = vi.fn();

const ETAPAS = [
  { idEtapa: 9, codigo: "governanca", nome: "Governança", ordem: 1 },
  { idEtapa: 10, codigo: "monitoramento", nome: "Monitoramento", ordem: 2 },
];

beforeEach(() => {
  criarEncontroMock.mockReset().mockResolvedValue({ idEncontro: 555 });
  buscarContratoParaFichaMock.mockReset();
  buscarEtapasDoProdutoMock.mockReset().mockResolvedValue(ETAPAS);
  onConcluido.mockReset();
  onCancelar.mockReset();
});

function renderizar(idProduto: number | undefined = 1) {
  return render(
    <EncontroForm idContrato={42} idProduto={idProduto} onConcluido={onConcluido} onCancelar={onCancelar} />
  );
}

async function selecionarEtapaGovernanca() {
  fireEvent.click(screen.getByRole("combobox", { name: "Etapa do Produto" }));
  fireEvent.click(await screen.findByRole("option", { name: "Governança" }));
}

async function selecionarTipoPontape() {
  fireEvent.click(screen.getByRole("combobox", { name: "Tipo de Registro" }));
  fireEvent.click(await screen.findByRole("option", { name: "Pontapé" }));
}

async function preencherCamposObrigatorios() {
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Sprint de setembro" } });
  await selecionarEtapaGovernanca();
  await selecionarTipoPontape();
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-09-20T14:00" } });
}

describe("EncontroForm — idProduto resolvido sem a prop (SPEC_DEVIATION documentada)", () => {
  it("sem idProduto por prop, resolve via buscarContratoParaFicha(idContrato)", async () => {
    buscarContratoParaFichaMock.mockResolvedValue({ idProduto: 3 });
    render(<EncontroForm idContrato={42} onConcluido={onConcluido} onCancelar={onCancelar} />);

    await waitFor(() => expect(buscarContratoParaFichaMock).toHaveBeenCalledWith(expect.anything(), 42));
    await waitFor(() => expect(buscarEtapasDoProdutoMock).toHaveBeenCalledWith(expect.anything(), 3));
  });
});

describe("EncontroForm (FMC-31 AC4) — Etapa lista só as do produto; escolher Etapa filtra o Tipo", () => {
  it("a Etapa oferece exatamente as ref_etapa do produto do contrato", async () => {
    renderizar();
    await waitFor(() => expect(buscarEtapasDoProdutoMock).toHaveBeenCalledWith(expect.anything(), 1));

    fireEvent.click(screen.getByRole("combobox", { name: "Etapa do Produto" }));
    expect(await screen.findByRole("option", { name: "Governança" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Monitoramento" })).toBeInTheDocument();
  });

  it("escolher a Etapa Governança mostra só o Tipo Pontapé (dela), não o de outra etapa", async () => {
    renderizar();
    await waitFor(() => expect(buscarEtapasDoProdutoMock).toHaveBeenCalled());
    await selecionarEtapaGovernanca();

    fireEvent.click(screen.getByRole("combobox", { name: "Tipo de Registro" }));
    expect(await screen.findByRole("option", { name: "Pontapé" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Sprint" })).not.toBeInTheDocument();
  });

  it("escolher a Etapa Monitoramento -- lado oposto -- mostra só o Tipo Sprint", async () => {
    renderizar();
    await waitFor(() => expect(buscarEtapasDoProdutoMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("combobox", { name: "Etapa do Produto" }));
    fireEvent.click(await screen.findByRole("option", { name: "Monitoramento" }));

    fireEvent.click(screen.getByRole("combobox", { name: "Tipo de Registro" }));
    expect(await screen.findByRole("option", { name: "Sprint" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Pontapé" })).not.toBeInTheDocument();
  });
});

describe("EncontroForm (FMC-31 AC5) — Modalidade Presencial mostra Local; Online esconde", () => {
  it("Presencial oferece o campo Local", async () => {
    renderizar();
    fireEvent.click(screen.getByRole("combobox", { name: "Modalidade (opcional)" }));
    fireEvent.click(await screen.findByRole("option", { name: "Presencial" }));

    expect(screen.getByLabelText("Local")).toBeInTheDocument();
  });

  it("Online -- lado oposto -- não oferece o campo Local", async () => {
    renderizar();
    fireEvent.click(screen.getByRole("combobox", { name: "Modalidade (opcional)" }));
    fireEvent.click(await screen.findByRole("option", { name: "Online" }));

    expect(screen.queryByLabelText("Local")).not.toBeInTheDocument();
  });
});

describe("EncontroForm (FMC-32 AC6) — participante externo vs usuário do sistema", () => {
  it("participante externo grava nome_livre + origem='externo', nunca id_usuario", async () => {
    renderizar();
    await preencherCamposObrigatorios();

    fireEvent.click(screen.getByRole("combobox", { name: "Tipo de participante" }));
    fireEvent.click(await screen.findByRole("option", { name: "Participante externo" }));

    fireEvent.change(screen.getByLabelText("Nome do participante externo"), {
      target: { value: "Vereadora Convidada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar participante" }));
    expect(screen.getByText("Vereadora Convidada")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Criar Encontro" }));

    await waitFor(() => expect(criarEncontroMock).toHaveBeenCalledTimes(1));
    const [, payload] = criarEncontroMock.mock.calls[0];
    expect(payload.participantes).toEqual([
      { idUsuario: null, nomeLivre: "Vereadora Convidada", origem: "externo" },
    ]);
  });

  it("participante usuário grava id_usuario, nunca nome_livre", async () => {
    renderizar();
    await preencherCamposObrigatorios();

    fireEvent.click(screen.getByRole("combobox", { name: "Selecione o usuário" }));
    fireEvent.click(await screen.findByRole("option", { name: "Ana Gestora" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar participante" }));
    expect(screen.getByText("Ana Gestora", { selector: "span" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Criar Encontro" }));

    await waitFor(() => expect(criarEncontroMock).toHaveBeenCalledTimes(1));
    const [, payload] = criarEncontroMock.mock.calls[0];
    expect(payload.participantes).toEqual([{ idUsuario: 5, nomeLivre: null, origem: "legisla" }]);
  });
});

describe("EncontroForm — submissão (FMC-30 AC2/AC3)", () => {
  it("envia titulo/etapa/tipo/datas/modalidade/local/tema e conclui com o idEncontro criado", async () => {
    renderizar();
    await preencherCamposObrigatorios();

    fireEvent.change(screen.getByLabelText("Fim (opcional)"), { target: { value: "2026-09-20T15:00" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Modalidade (opcional)" }));
    fireEvent.click(await screen.findByRole("option", { name: "Presencial" }));
    fireEvent.change(screen.getByLabelText("Local"), { target: { value: "Sala 2" } });
    fireEvent.change(screen.getByLabelText("Tema Prioritário (opcional)"), { target: { value: "Orçamento" } });

    fireEvent.click(screen.getByRole("button", { name: "Criar Encontro" }));

    await waitFor(() => expect(criarEncontroMock).toHaveBeenCalledTimes(1));
    const [, payload] = criarEncontroMock.mock.calls[0];
    expect(payload).toMatchObject({
      idContrato: 42,
      titulo: "Sprint de setembro",
      idEtapa: 9,
      idTipoRegistro: 61,
      dtInicio: "2026-09-20T14:00",
      dtFim: "2026-09-20T15:00",
      modalidade: "presencial",
      local: "Sala 2",
      tema: "Orçamento",
    });
    expect(onConcluido).toHaveBeenCalledWith({ idEncontro: 555 });
  });

  it("erro do RPC renderiza <ErroInline>, sem concluir", async () => {
    criarEncontroMock.mockRejectedValue(new Error("Você não tem permissão para realizar esta operação."));
    renderizar();
    await preencherCamposObrigatorios();

    fireEvent.click(screen.getByRole("button", { name: "Criar Encontro" }));

    expect(await screen.findByText("Você não tem permissão para realizar esta operação.")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível criar o encontro")).toBeInTheDocument();
    expect(onConcluido).not.toHaveBeenCalled();
  });
});

describe("EncontroForm — cancelamento", () => {
  it("botão Cancelar aciona onCancelar sem chamar a RPC", () => {
    renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(criarEncontroMock).not.toHaveBeenCalled();
  });
});
