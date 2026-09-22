import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FatoGeradorResumo } from "@backend/queries/incidencia";

// Spec anchor: .specs/features/fatos-geradores-ciclo-vida/spec.md, "P1: Fato
// projetado e sua realização" AC6 -- realizados e "N projeções em aberto"
// sempre distintos na tela. Layout: Figma 109:60 (5 cartões).

vi.mock("@backend/queries/incidencia", async (importOriginal) => {
  const original = await importOriginal<typeof import("@backend/queries/incidencia")>();
  return { ...original, buscarIipContrato: vi.fn().mockResolvedValue({ nrFatos: null, iipProvisorio: null }) };
});
vi.mock("@backend/rpc/iip", () => ({ atualizaIipContrato: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@backend/supabase/client", () => ({ createClient: () => ({}) }));

import { IncidenciaKpis } from "./incidencia-kpis";

function fato(situacao: "realizado" | "projetado"): FatoGeradorResumo {
  return {
    idFatoGerador: Math.random(),
    tipologia: "x",
    niveis: { d1: "baixo", d2: null, d3: null },
    titulo: "t",
    situacao,
    dtOcorrencia: situacao === "realizado" ? "2026-09-01" : null,
    dtPrevista: situacao === "projetado" ? "2026-10-01" : null,
  };
}

const CONTAGENS = { totalInsights: 0, totalPreInsights: 0, totalRegistros: 0 };

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("IncidenciaKpis — Fatos Geradores (spec.md AC6)", () => {
  it("mostra realizados/total com barra e as projeções em aberto separadas", async () => {
    render(
      <IncidenciaKpis
        idContrato={7}
        fatosGeradores={[fato("realizado"), fato("realizado"), fato("projetado")]}
        {...CONTAGENS}
      />
    );

    const cartao = screen.getByRole("group", { name: "Fatos Geradores" });
    await waitFor(() => expect(within(cartao).getByText("2/3")).toBeInTheDocument());
    expect(within(cartao).getByText("1 projeções em aberto")).toBeInTheDocument();

    const barra = within(cartao).getByRole("progressbar");
    expect(barra).toHaveAttribute("aria-valuenow", "2");
    expect(barra).toHaveAttribute("aria-valuemax", "3");
  });

  it("projeção não conta como realizado: 0 realizados de 2 registrados", async () => {
    render(<IncidenciaKpis idContrato={7} fatosGeradores={[fato("projetado"), fato("projetado")]} {...CONTAGENS} />);

    const cartao = screen.getByRole("group", { name: "Fatos Geradores" });
    await waitFor(() => expect(within(cartao).getByText("0/2")).toBeInTheDocument());
    expect(within(cartao).getByText("2 projeções em aberto")).toBeInTheDocument();
  });

  it("sem nenhum fato, mostra 0 e 0 projeções, sem barra (nunca oculta o card)", async () => {
    render(<IncidenciaKpis idContrato={7} fatosGeradores={[]} {...CONTAGENS} />);

    const cartao = screen.getByRole("group", { name: "Fatos Geradores" });
    await waitFor(() => expect(within(cartao).getByText("0")).toBeInTheDocument());
    expect(within(cartao).getByText("0 projeções em aberto")).toBeInTheDocument();
    expect(within(cartao).queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("IncidenciaKpis — Insights, Pré-Insights e Registros", () => {
  it("cada cartão mostra a sua contagem", async () => {
    render(
      <IncidenciaKpis
        idContrato={7}
        fatosGeradores={[]}
        totalInsights={8}
        totalPreInsights={5}
        totalRegistros={47}
      />
    );

    await waitFor(() => expect(screen.getByRole("group", { name: "Insights" })).toHaveTextContent("8"));
    expect(screen.getByRole("group", { name: "Pré-Insights" })).toHaveTextContent("5");
    expect(screen.getByRole("group", { name: "Registros" })).toHaveTextContent("47");
  });

  it("zero é número medido, não some do cartão", async () => {
    render(<IncidenciaKpis idContrato={7} fatosGeradores={[]} {...CONTAGENS} />);

    await waitFor(() => expect(screen.getByRole("group", { name: "Registros" })).toHaveTextContent("0"));
  });
});
