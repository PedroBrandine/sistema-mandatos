import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MentoradoPll } from "@backend/queries/pll-dashboard";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

import { TabelaMentoradosPll } from "./tabela-mentorados-pll";

// Spec anchor: pll-dashboard-agenda T10 Done-when (tasks.md) -- PLL-DB-07…11.
// AD-046: caminho feliz de cada AC.

afterEach(cleanup);
beforeEach(() => mocks.push.mockReset());

const MENTORADOS: MentoradoPll[] = [
  {
    idContrato: 1,
    nomeMentorado: "Ana Souza",
    nomeParlamentar: "Dep. João Silva",
    siglaPartido: "PT",
    siglaUf: "SP",
    nomeMentor: "Carla Mentora",
    mentoriasRealizadas: 3,
    pctAtingimento: 60,
    status: "ativo",
    nomeEdicao: "2026.1",
  },
  {
    idContrato: 2,
    nomeMentorado: "Beatriz Lima",
    nomeParlamentar: "Sen. Maria Alves",
    siglaPartido: null,
    siglaUf: null,
    nomeMentor: null,
    mentoriasRealizadas: 5,
    pctAtingimento: null,
    status: "desistente",
    nomeEdicao: null,
  },
];

describe("TabelaMentoradosPll (PLL-DB-07)", () => {
  it("exibe uma linha por mentorado com as colunas do spec", () => {
    render(<TabelaMentoradosPll mentorados={MENTORADOS} />);

    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Dep. João Silva")).toBeInTheDocument();
    expect(screen.getByText("PT")).toBeInTheDocument();
    expect(screen.getByText("SP")).toBeInTheDocument();
    expect(screen.getByText("Carla Mentora")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("2026.1")).toBeInTheDocument();
  });

  it("célula sem valor mostra '—', nunca vazia ou 'N/A' (PLL-DB-10)", () => {
    render(<TabelaMentoradosPll mentorados={MENTORADOS} />);

    expect(screen.getByText("Beatriz Lima").closest("tr")).toHaveTextContent("——");
  });
});

describe("TabelaMentoradosPll — busca (PLL-DB-09)", () => {
  it("filtra por nome do mentorado", () => {
    render(<TabelaMentoradosPll mentorados={MENTORADOS} />);

    fireEvent.change(screen.getByRole("textbox", { name: /Buscar por participante ou parlamentar/i }), {
      target: { value: "ana" },
    });

    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.queryByText("Beatriz Lima")).not.toBeInTheDocument();
  });

  it("filtra por nome do parlamentar, sem diferenciar acento/caixa", () => {
    render(<TabelaMentoradosPll mentorados={MENTORADOS} />);

    fireEvent.change(screen.getByRole("textbox", { name: /Buscar por participante ou parlamentar/i }), {
      target: { value: "MARIA" },
    });

    expect(screen.getByText("Beatriz Lima")).toBeInTheDocument();
    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument();
  });
});

describe("TabelaMentoradosPll — ordenação (PLL-DB-08)", () => {
  it("clicar no cabeçalho ordena pela coluna, alternando crescente/decrescente", () => {
    render(<TabelaMentoradosPll mentorados={MENTORADOS} />);

    fireEvent.click(screen.getByRole("button", { name: /Mentorias/i }));

    // As linhas de dado têm role="link" (mesmo padrão de TabelaPendencias),
    // então "row" só bate com o cabeçalho -- as linhas se buscam por "link".
    const linhas = screen.getAllByRole("link");
    expect(linhas[0]).toHaveTextContent("Ana Souza"); // 3, crescente

    fireEvent.click(screen.getByRole("button", { name: /Mentorias/i }));
    const linhasInvertidas = screen.getAllByRole("link");
    expect(linhasInvertidas[0]).toHaveTextContent("Beatriz Lima"); // 5, decrescente
  });
});

describe("TabelaMentoradosPll — navegação (PLL-DB-11)", () => {
  it("clicar numa linha navega para /contratos/[id] daquele contrato", () => {
    render(<TabelaMentoradosPll mentorados={MENTORADOS} />);

    fireEvent.click(screen.getByText("Ana Souza").closest("tr")!);

    expect(mocks.push).toHaveBeenCalledWith("/contratos/1");
  });
});

describe("TabelaMentoradosPll — estados vazios", () => {
  it("sem mentorados mostra estado vazio", () => {
    render(<TabelaMentoradosPll mentorados={[]} />);
    expect(screen.getByText("Nenhum mentorado encontrado")).toBeInTheDocument();
  });

  it("busca sem resultado mostra estado vazio próprio", () => {
    render(<TabelaMentoradosPll mentorados={MENTORADOS} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Buscar por participante ou parlamentar/i }), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("Nenhum resultado para a busca")).toBeInTheDocument();
  });
});
