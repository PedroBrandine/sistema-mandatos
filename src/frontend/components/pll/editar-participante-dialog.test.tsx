import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Sessão 23/09 (Pedro): "não tem crud no lançamento da tabela" -- corrige os
// campos autodeclarados do Anexo A já importados (mesmo recorte de
// LinhaCadastroParticipanteParaEdicao), sem reimportar a planilha inteira.
// Mesmos stubs de jsdom que os outros dialogs Radix da pasta precisam.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}
if (!Element.prototype.hasPointerCapture) {
  (Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
}

import { EditarParticipanteDialog } from "./editar-participante-dialog";

afterEach(cleanup);

const LINHA = {
  nomeCompleto: "Fulana de Tal",
  email: "fulana@teste.com",
  telefone: "11999999999",
  corRaca: "Parda",
  partidoFiliado: "PT",
  nomeParlamentar: "Dep. Fulano",
  corRacaParlamentar: "Branca",
  partidoParlamentar: "PT",
  estadoEleicao: "SP",
  cargosAnteriores: "Vereador",
  mandatosAnteriores: "1 mandato",
  redeSocial: "@fulana",
};

describe("EditarParticipanteDialog", () => {
  it("carregando=true mostra skeleton, nunca o formulário", () => {
    render(
      <EditarParticipanteDialog
        open
        onOpenChange={vi.fn()}
        nomeCompleto="Fulana de Tal"
        linha={undefined}
        carregando
        erroCarregar={false}
        onSalvar={vi.fn()}
      />
    );

    expect(screen.getByRole("status", { name: "Carregando" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
  });

  it("lado oposto: erroCarregar=true mostra ErroInline, nunca o formulário", () => {
    render(
      <EditarParticipanteDialog
        open
        onOpenChange={vi.fn()}
        nomeCompleto="Fulana de Tal"
        linha={undefined}
        carregando={false}
        erroCarregar
        onSalvar={vi.fn()}
      />
    );

    expect(screen.getByText("Não foi possível carregar os dados deste participante.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
  });

  it("com a linha carregada, pré-preenche todos os campos do formulário", () => {
    render(
      <EditarParticipanteDialog
        open
        onOpenChange={vi.fn()}
        nomeCompleto="Fulana de Tal"
        linha={LINHA}
        carregando={false}
        erroCarregar={false}
        onSalvar={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Nome completo")).toHaveValue("Fulana de Tal");
    expect(screen.getByLabelText("E-mail")).toHaveValue("fulana@teste.com");
    expect(screen.getByLabelText("Nome do Parlamentar")).toHaveValue("Dep. Fulano");
    expect(screen.getByLabelText("Cargos anteriores")).toHaveValue("Vereador");
  });

  it("editar um campo e salvar chama onSalvar com o valor corrigido, mantendo os demais intactos", async () => {
    const onSalvar = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <EditarParticipanteDialog
        open
        onOpenChange={onOpenChange}
        nomeCompleto="Fulana de Tal"
        linha={LINHA}
        carregando={false}
        erroCarregar={false}
        onSalvar={onSalvar}
      />
    );

    fireEvent.change(screen.getByLabelText("Nome do Parlamentar"), { target: { value: "Dep. Fulano Corrigido" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(onSalvar).toHaveBeenCalledWith(
        expect.objectContaining({ ...LINHA, nomeParlamentar: "Dep. Fulano Corrigido" })
      )
    );
    // Salvar com sucesso fecha o dialog (onFechar -> onOpenChange(false)).
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("lado oposto: onSalvar rejeitando mostra a mensagem de erro e NÃO fecha o dialog", async () => {
    const onSalvar = vi.fn().mockRejectedValue(new Error("Não foi possível salvar as alterações do PT."));
    const onOpenChange = vi.fn();
    render(
      <EditarParticipanteDialog
        open
        onOpenChange={onOpenChange}
        nomeCompleto="Fulana de Tal"
        linha={LINHA}
        carregando={false}
        erroCarregar={false}
        onSalvar={onSalvar}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Não foi possível salvar as alterações do PT.")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("cancelar chama onOpenChange(false) sem chamar onSalvar", () => {
    const onSalvar = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <EditarParticipanteDialog
        open
        onOpenChange={onOpenChange}
        nomeCompleto="Fulana de Tal"
        linha={LINHA}
        carregando={false}
        erroCarregar={false}
        onSalvar={onSalvar}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSalvar).not.toHaveBeenCalled();
  });
});
