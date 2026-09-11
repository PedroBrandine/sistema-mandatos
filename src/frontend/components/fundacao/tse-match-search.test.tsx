import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec anchor: redesenho-estrategia-tela-first / EST-10 (T22, AD-042 -- tela
// de escrita, profundidade completa exigida mesmo com AD-046 ativo, porque a
// própria AD-046 excetua T22-T24 do corte).
//
// Estratégia de teste (achado empírico desta task, ver comentários em
// tse-match-search.tsx). O obstáculo é o <Popover> (Radix Popper): com ele
// montado, o setTimeout real do debounce (`use-debounce`) nunca chega a
// disparar em jsdom -- reproduzido com timers reais (até 40s de espera real)
// e com timers falsos (`vi.useFakeTimers` trava o próprio teste, o loop de
// posicionamento nunca estabiliza sob avanço instantâneo). <Command> (cmdk)
// sozinho, sem o Popover em volta, monta normalmente -- é o que o terceiro
// bloco explora.
//
// Daí a divisão em 3 blocos, que juntos cobrem AD-042 integral:
//  1. `useBuscaTse` via renderHook -- QUANDO cada estado acontece: os dois
//     lados de AC1/AC2 (mín. 3 letras) e a origem do erro de AC8.
//  2. `ResultadosBuscaTse` dentro de <Command> -- O QUE a tela mostra em
//     cada estado, no DOM de verdade: ErroInline presente e ausente (AC8,
//     dois lados), estado vazio, carregando e lista com seleção.
//  3. `TseMatchSearch` inteiro -- a composição estática, sem depender do
//     debounce.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ?? ResizeObserverStub;

// cmdk rola o item ativo para a vista ao montar/selecionar; jsdom não
// implementa scrollIntoView. Mesmo caso do ResizeObserver acima.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoViewStub() {};
}

const buscarCandidaturasMock = vi.fn();

vi.mock("@backend/queries/tse", () => ({
  buscarCandidaturas: (...args: unknown[]) => buscarCandidaturasMock(...args),
}));

vi.mock("@backend/supabase/client", () => ({
  createClient: () => ({}),
}));

import { Command } from "@/components/ui/command";

import { ResultadosBuscaTse, TseMatchSearch, useBuscaTse } from "./tse-match-search";

const CANDIDATURA_ALTA = {
  anoEleicao: 2022,
  sqCandidato: 111,
  nrTurno: 1,
  nrTituloEleitoral: "123456789012",
  nmCandidato: "PEDRO ANTONIO BIGARDI",
  nmUrna: "PEDRO BIGARDI",
  sgUf: "SP",
  nmMunicipioPrincipal: "CAMPINAS",
  sgPartido: "PC do B",
  cdCargo: 7,
  dsGenero: "MASCULINO",
  qtVotosTotal: 1000,
  metodoMatch: "nome_uf_cargo" as const,
  confianca: "alta" as const,
};

beforeEach(() => {
  buscarCandidaturasMock.mockReset();
});

afterEach(cleanup);

describe("useBuscaTse (EST-10)", () => {
  it("menos de 3 letras não dispara busca (AC1)", async () => {
    buscarCandidaturasMock.mockResolvedValue([]);
    const { result } = renderHook(
      ({ nome }) => useBuscaTse({ nome, sgUf: "", anoEleicao: "" }),
      { initialProps: { nome: "pe" } }
    );

    // Debounce é 500ms; 700ms reais é suficiente e o hook roda fora de
    // qualquer Popover/Command, então o timer real dispara normalmente.
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(buscarCandidaturasMock).not.toHaveBeenCalled();
    expect(result.current.buscando).toBe(false);
    expect(result.current.resultadosExibidos).toBeNull();
  });

  it("3 letras ou mais dispara a busca e expõe os resultados (AC2)", async () => {
    buscarCandidaturasMock.mockResolvedValue([CANDIDATURA_ALTA]);
    const { result } = renderHook(
      ({ nome }) => useBuscaTse({ nome, sgUf: "SP", anoEleicao: "2022" }),
      { initialProps: { nome: "ped" } }
    );

    await waitFor(() => expect(buscarCandidaturasMock).toHaveBeenCalledTimes(1));
    expect(buscarCandidaturasMock).toHaveBeenCalledWith(
      {},
      { nome: "ped", sgUf: "SP", anoEleicao: 2022 }
    );

    await waitFor(() => expect(result.current.resultadosExibidos).toEqual([CANDIDATURA_ALTA]));
    expect(result.current.modoManualAtivo).toBe(false);
    expect(result.current.erro).toBeNull();
  });

  it("falha da busca preenche erro com a mensagem esperada (AC8)", async () => {
    buscarCandidaturasMock.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(
      ({ nome }) => useBuscaTse({ nome, sgUf: "", anoEleicao: "" }),
      { initialProps: { nome: "ped" } }
    );

    await waitFor(() =>
      expect(result.current.erro).toBe("Não foi possível buscar candidaturas agora. Tente novamente.")
    );
    expect(result.current.buscando).toBe(false);
  });

  it("sem resultados ativa modo manual e não preenche erro", async () => {
    buscarCandidaturasMock.mockResolvedValue([]);
    const { result } = renderHook(
      ({ nome }) => useBuscaTse({ nome, sgUf: "", anoEleicao: "" }),
      { initialProps: { nome: "zzz" } }
    );

    await waitFor(() => expect(result.current.resultadosExibidos).toEqual([]));
    expect(result.current.modoManualAtivo).toBe(true);
    expect(result.current.erro).toBeNull();
  });
});

// O hook acima cobre QUANDO cada estado acontece; este bloco cobre O QUE a
// tela mostra em cada um deles -- incluindo os dois que o Done-when de T22
// nomeia por elemento ("renderiza ErroInline") e que uma asserção sobre a
// string de estado do hook não provaria. <Command> monta sem problema em
// jsdom; o que não estabiliza é o <Popover> em volta dele.
describe("ResultadosBuscaTse (EST-10) — os 4 estados da lista", () => {
  function renderizar(props: Partial<Parameters<typeof ResultadosBuscaTse>[0]> = {}) {
    return render(
      <Command shouldFilter={false}>
        <ResultadosBuscaTse
          buscando={false}
          erro={null}
          resultados={null}
          onSelecionar={vi.fn()}
          {...props}
        />
      </Command>
    );
  }

  it("falha da busca renderiza ErroInline com a mensagem (AC8)", () => {
    renderizar({ erro: "Não foi possível buscar candidaturas agora. Tente novamente." });

    // ErroInline = <Alert variant="destructive">, com título próprio.
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível buscar")).toBeInTheDocument();
    expect(
      screen.getByText("Não foi possível buscar candidaturas agora. Tente novamente.")
    ).toBeInTheDocument();
  });

  it("sem erro não renderiza ErroInline (AC8, lado oposto)", () => {
    renderizar({ resultados: [CANDIDATURA_ALTA] });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Não foi possível buscar")).not.toBeInTheDocument();
  });

  it("busca sem resultados mostra o estado vazio", () => {
    renderizar({ resultados: [] });

    expect(screen.getByText("Nenhuma candidatura encontrada.")).toBeInTheDocument();
  });

  it("com resultados lista a candidatura e seleciona ao clicar (AC2)", () => {
    const onSelecionar = vi.fn();
    renderizar({ resultados: [CANDIDATURA_ALTA], onSelecionar });

    expect(screen.getByText("PEDRO BIGARDI")).toBeInTheDocument();
    expect(screen.getByText("SP")).toBeInTheDocument();
    expect(screen.getByText("PC do B")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma candidatura encontrada.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("PEDRO BIGARDI"));
    expect(onSelecionar).toHaveBeenCalledWith(CANDIDATURA_ALTA);
  });

  it("enquanto busca mostra 'Buscando...' e nada mais", () => {
    renderizar({ buscando: true, resultados: [] });

    expect(screen.getByText("Buscando...")).toBeInTheDocument();
    // O estado vazio não pode aparecer junto: durante a busca ainda não se
    // sabe se há resultados.
    expect(screen.queryByText("Nenhuma candidatura encontrada.")).not.toBeInTheDocument();
  });
});

describe("TseMatchSearch (EST-10) — composição estática", () => {
  it("renderiza o campo de busca e mantém 'Cadastro manual' como irmão acessível (AC8)", () => {
    const onManual = vi.fn();
    render(
      <div>
        <TseMatchSearch onSelecionar={vi.fn()} />
        <button type="button" onClick={onManual}>
          Cadastro manual pela mesma tela
        </button>
      </div>
    );

    expect(screen.getByRole("combobox")).toHaveTextContent(/buscar candidato no tse/i);
    // AC8: o botão de cadastro manual não está condicionado a nenhum estado
    // interno de TseMatchSearch -- é sempre renderizado, mesmo antes de
    // qualquer busca ou erro acontecer.
    const botaoManual = screen.getByRole("button", { name: "Cadastro manual pela mesma tela" });
    expect(botaoManual).toBeEnabled();
  });
});
