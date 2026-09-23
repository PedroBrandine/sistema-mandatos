import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// diagnostico-participante-pll (Agenda PLL, Figma 328:1262).

const mocks = vi.hoisted(() => ({
  atualizarStatusEncontro: vi.fn(),
  criarEncontro: vi.fn(),
  marcarPresenca: vi.fn(),
}));

vi.mock("@backend/rpc/encontro", () => ({
  atualizarStatusEncontro: mocks.atualizarStatusEncontro,
  criarEncontro: mocks.criarEncontro,
  marcarPresenca: mocks.marcarPresenca,
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

import type { AgendaMentoriasPll } from "@backend/queries/pll-mentorias";
import { TabelaMentoriasPll } from "./tabela-mentorias-pll";

const AGENDA_BASE: AgendaMentoriasPll = {
  idEtapa: 900,
  idTipoRegistro: 901,
  qtdPrevista: 5,
  nomeMentor: "Carlos Mendes",
  slots: [
    { nrSequencia: 1, idEncontro: 501, status: "realizado", dtPrevistaInicio: "2026-03-12T00:00:00-03:00", dtRealizada: "2026-03-12T00:00:00-03:00", registro: { resumo: "Foi ótimo", nomeAutor: "Ana" } },
    { nrSequencia: 2, idEncontro: 502, status: "planejado", dtPrevistaInicio: "2026-05-15T00:00:00-03:00", dtRealizada: null, registro: null },
    { nrSequencia: 3, idEncontro: null, status: null, dtPrevistaInicio: null, dtRealizada: null, registro: null },
    { nrSequencia: 4, idEncontro: null, status: null, dtPrevistaInicio: null, dtRealizada: null, registro: null },
    { nrSequencia: 5, idEncontro: null, status: null, dtPrevistaInicio: null, dtRealizada: null, registro: null },
  ],
};

beforeEach(() => {
  mocks.atualizarStatusEncontro.mockReset().mockResolvedValue(undefined);
  mocks.criarEncontro.mockReset().mockResolvedValue({ idEncontro: 999 });
  mocks.marcarPresenca.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

// "Mentoria N" aparece 2x (linha da tabela + card de Registros) -- pega a
// que está dentro de uma <tr>.
function linhaDaTabela(rotulo: string): HTMLElement {
  const elemento = screen
    .getAllByText(rotulo)
    .map((el) => el.closest("tr"))
    .find((tr): tr is HTMLTableRowElement => tr !== null);
  if (!elemento) throw new Error(`Nenhuma linha de tabela encontrada para "${rotulo}"`);
  return elemento;
}

describe("TabelaMentoriasPll", () => {
  it("renderiza os 5 slots, com 'Não preenchido' nos que ainda não têm encontro", async () => {
    render(<TabelaMentoriasPll idContrato={43} agenda={AGENDA_BASE} onAtualizado={() => {}} />);

    expect(screen.getAllByText("Mentoria 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mentoria 5").length).toBeGreaterThan(0);
    // 3 slots sem encontro x 2 colunas ("Data prevista" + "Mentor" lê o
    // mentor único da agenda, não por slot) -- só a coluna de data usa
    // "Não preenchido" por slot vazio.
    expect(screen.getAllByText("Não preenchido")).toHaveLength(3);
  });

  it("Mentoria 1 (realizado) mostra o registro real -- não uma 2ª caixa 'Registro do Mandato'", () => {
    render(<TabelaMentoriasPll idContrato={43} agenda={AGENDA_BASE} onAtualizado={() => {}} />);

    expect(screen.getByText("Foi ótimo")).toBeInTheDocument();
    expect(screen.getByText("Registrado por Ana")).toBeInTheDocument();
    expect(screen.queryByText(/Registro do Mandato/i)).not.toBeInTheDocument();
  });

  it("slot sem encontro (nr 3) mostra só o botão Agendar", () => {
    render(<TabelaMentoriasPll idContrato={43} agenda={AGENDA_BASE} onAtualizado={() => {}} />);

    const linhaMentoria3 = linhaDaTabela("Mentoria 3");
    expect(within(linhaMentoria3).getByRole("button", { name: "Agendar" })).toBeInTheDocument();
    expect(within(linhaMentoria3).queryByRole("button", { name: "Marcar presença" })).not.toBeInTheDocument();
  });

  it("slot planejado (nr 2) mostra Marcar presença/Remarcar/Cancelar; clicar em Marcar presença chama marcarPresenca com o idEncontro certo", async () => {
    const onAtualizado = vi.fn();
    render(<TabelaMentoriasPll idContrato={43} agenda={AGENDA_BASE} onAtualizado={onAtualizado} />);

    const linhaMentoria2 = linhaDaTabela("Mentoria 2");
    fireEvent.click(within(linhaMentoria2).getByRole("button", { name: "Marcar presença" }));

    await waitFor(() => expect(mocks.marcarPresenca).toHaveBeenCalledWith(expect.anything(), { idEncontro: 502 }));
    await waitFor(() => expect(onAtualizado).toHaveBeenCalled());
  });

  it("clicar em Cancelar chama atualizarStatusEncontro com status='cancelado'", async () => {
    render(<TabelaMentoriasPll idContrato={43} agenda={AGENDA_BASE} onAtualizado={() => {}} />);

    const linhaMentoria2 = linhaDaTabela("Mentoria 2");
    fireEvent.click(within(linhaMentoria2).getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(mocks.atualizarStatusEncontro).toHaveBeenCalledWith(expect.anything(), { idEncontro: 502, status: "cancelado" })
    );
  });

  it("Agendar abre o diálogo, e enviar chama criarEncontro com idContrato/idEtapa/idTipoRegistro/nrSequencia certos", async () => {
    const onAtualizado = vi.fn();
    render(<TabelaMentoriasPll idContrato={43} agenda={AGENDA_BASE} onAtualizado={onAtualizado} />);

    const linhaMentoria4 = linhaDaTabela("Mentoria 4");
    fireEvent.click(within(linhaMentoria4).getByRole("button", { name: "Agendar" }));

    const dialogo = await screen.findByRole("dialog");
    fireEvent.change(within(dialogo).getByLabelText("Data e horário"), { target: { value: "2026-10-01T10:00" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Agendar" }));

    await waitFor(() =>
      expect(mocks.criarEncontro).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ idContrato: 43, idEtapa: 900, idTipoRegistro: 901, nrSequencia: 4, titulo: "Mentoria 4" })
      )
    );
    await waitFor(() => expect(onAtualizado).toHaveBeenCalled());
  });
});
