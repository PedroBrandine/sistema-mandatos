import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContratoCard } from "@backend/queries/mandatos-lista";
import { PermissaoNegadaError } from "@backend/rpc/errors";

// Exclusão definitiva de mandato pela aba Mandatos (pedido de Pedro,
// 2026-09-21; simplificado em 2026-09-22 -- sem exigir digitar o nome). É
// ação irreversível: aqui se prova que o resumo do que sai aparece ANTES do
// botão final, e que uma falha do banco fica na tela em vez de fingir
// sucesso.

const mocks = vi.hoisted(() => ({
  resumoExclusaoContrato: vi.fn(),
  excluirContrato: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@backend/rpc/exclusao", () => ({
  resumoExclusaoContrato: mocks.resumoExclusaoContrato,
  excluirContrato: mocks.excluirContrato,
}));
vi.mock("@backend/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

import { EditarContratoDialog } from "./editar-contrato-dialog";

const CONTRATO: ContratoCard = {
  idContrato: 42,
  nomeContratante: "Dep. Ana Ribeiro",
  dtInicio: "2026-01-10",
  dtFim: null,
  status: "ativo",
  nomeGestora: null,
  nomeProjeto: null,
  nomeEtapaAtual: null,
  nomeResponsavel: null,
  atualizadoEm: "2026-09-12T10:00:00Z",
};

const RESUMO = {
  idContrato: 42,
  nomeContratante: "Dep. Ana Ribeiro",
  tipoContratante: "mandato",
  apagaContratante: true,
  contagens: { registros: 47, fatos_geradores: 12, objetivos: 3, metas: 9, encontros: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resumoExclusaoContrato.mockResolvedValue(RESUMO);
  mocks.excluirContrato.mockResolvedValue(RESUMO);
});
afterEach(cleanup);

function abrir(props: Partial<Parameters<typeof EditarContratoDialog>[0]> = {}) {
  const onOpenChange = vi.fn();
  const onExcluido = vi.fn();
  render(<EditarContratoDialog contrato={CONTRATO} onOpenChange={onOpenChange} onExcluido={onExcluido} {...props} />);
  return { onOpenChange, onExcluido };
}

async function irParaConfirmacao() {
  fireEvent.click(screen.getByRole("button", { name: "Excluir mandato" }));
  await screen.findByText("Será apagado do banco:");
}

describe("EditarContratoDialog", () => {
  it("abre em 'Editar contrato' com o botão Excluir mandato, sem chamar o banco ainda", () => {
    abrir();

    expect(screen.getByRole("heading", { name: "Editar contrato" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir mandato" })).toBeInTheDocument();
    expect(mocks.resumoExclusaoContrato).not.toHaveBeenCalled();
    expect(mocks.excluirContrato).not.toHaveBeenCalled();
  });

  it("sem contrato selecionado, nada é renderizado", () => {
    abrir({ contrato: null });

    expect(screen.queryByRole("heading", { name: "Editar contrato" })).not.toBeInTheDocument();
  });

  it("Excluir mandato mostra o que sai (com o 2º nível) e que o cadastro da pessoa também sai", async () => {
    abrir();
    await irParaConfirmacao();

    expect(mocks.resumoExclusaoContrato).toHaveBeenCalledWith({}, 42);
    expect(screen.getByText("47 registros")).toBeInTheDocument();
    expect(screen.getByText("12 fatos geradores")).toBeInTheDocument();
    expect(screen.getByText("3 objetivos específicos")).toBeInTheDocument();
    expect(screen.getByText("9 metas")).toBeInTheDocument();
    // Zero não vira linha.
    expect(screen.queryByText(/encontro/)).not.toBeInTheDocument();
    expect(screen.getByText("O cadastro do parlamentar (contratante e mandato)")).toBeInTheDocument();
    // Nada foi apagado ainda.
    expect(mocks.excluirContrato).not.toHaveBeenCalled();
  });

  it("quando a pessoa tem outro contrato, avisa que o cadastro dela fica", async () => {
    mocks.resumoExclusaoContrato.mockResolvedValue({ ...RESUMO, apagaContratante: false });
    abrir();
    await irParaConfirmacao();

    expect(screen.queryByText("O cadastro do parlamentar (contratante e mandato)")).not.toBeInTheDocument();
    // "não" está num <strong>: o matcher olha o texto completo do parágrafo.
    expect(
      screen.getByText((_, el) => el?.tagName === "P" && /cadastro do parlamentar não será apagado/.test(el.textContent ?? ""))
    ).toBeInTheDocument();
  });

  it("o botão final fica habilitado assim que o resumo carrega, sem exigir digitar nada", async () => {
    abrir();
    await irParaConfirmacao();

    expect(screen.getByRole("button", { name: /Excluir definitivamente/ })).toBeEnabled();
    expect(screen.queryByLabelText(/Para confirmar, digite/)).not.toBeInTheDocument();
  });

  it("confirmar exclui, avisa a página, mostra o toast e fecha", async () => {
    const { onExcluido, onOpenChange } = abrir();
    await irParaConfirmacao();

    fireEvent.click(screen.getByRole("button", { name: /Excluir definitivamente/ }));

    await waitFor(() => expect(mocks.excluirContrato).toHaveBeenCalledWith({}, 42));
    await waitFor(() => expect(onExcluido).toHaveBeenCalledTimes(1));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Mandato de Dep. Ana Ribeiro excluído.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("falha do banco fica na tela, não fecha e não avisa a página", async () => {
    mocks.excluirContrato.mockRejectedValue(new PermissaoNegadaError());
    const { onExcluido, onOpenChange } = abrir();
    await irParaConfirmacao();

    fireEvent.click(screen.getByRole("button", { name: /Excluir definitivamente/ }));

    expect(await screen.findByText("Você não tem permissão para realizar esta operação.")).toBeInTheDocument();
    expect(onExcluido).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("falha ao levantar o resumo impede a exclusão (não apaga às cegas)", async () => {
    mocks.resumoExclusaoContrato.mockRejectedValue(new PermissaoNegadaError());
    abrir();

    fireEvent.click(screen.getByRole("button", { name: "Excluir mandato" }));

    expect(await screen.findByText("Você não tem permissão para realizar esta operação.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir definitivamente/ })).toBeDisabled();
    expect(mocks.excluirContrato).not.toHaveBeenCalled();
  });
});
