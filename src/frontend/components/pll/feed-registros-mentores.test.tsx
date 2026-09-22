import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RegistroMentor } from "@backend/queries/pll-dashboard";

import { FeedRegistrosMentores, formatarDataHoraRegistro } from "./feed-registros-mentores";

// Spec anchor: pll-dashboard-agenda T11 Done-when (tasks.md) -- PLL-DB-12…14.
// AD-046: caminho feliz de cada AC (mais o par explícito que o Done-when de
// T11 pede: Hoje/Ontem/data antiga).

afterEach(cleanup);

const HOJE = "2026-09-18";

const REGISTRO: RegistroMentor = {
  idRegistro: 1,
  nomeAutor: "Carla Mentora",
  nomeMentorado: "Ana Souza",
  ocorridoEm: "2026-09-18T21:30:00-03:00",
  resumo: "Conversa sobre o próximo encontro.",
};

describe("FeedRegistrosMentores (PLL-DB-12)", () => {
  it("lista os registros com autor, mentorado, data/hora e resumo", () => {
    render(<FeedRegistrosMentores registros={[REGISTRO]} hoje={HOJE} />);

    expect(screen.getByText("Carla Mentora")).toBeInTheDocument();
    expect(screen.getByText("Mentorado: Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Conversa sobre o próximo encontro.")).toBeInTheDocument();
    expect(screen.getByText("Hoje às 21:30")).toBeInTheDocument();
  });

  it("registro sem mentorado pareado mostra '—' (AD-005)", () => {
    render(<FeedRegistrosMentores registros={[{ ...REGISTRO, nomeMentorado: null }]} hoje={HOJE} />);
    expect(screen.getByText("Mentorado: —")).toBeInTheDocument();
  });

  it("registro sem resumo mostra '—' (PLL-DB-14)", () => {
    render(<FeedRegistrosMentores registros={[{ ...REGISTRO, resumo: null }]} hoje={HOJE} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("sem nenhum registro no recorte mostra o estado vazio", () => {
    render(<FeedRegistrosMentores registros={[]} hoje={HOJE} />);
    expect(screen.getByText("Nenhum registro no recorte")).toBeInTheDocument();
  });
});

describe("formatarDataHoraRegistro (PLL-DB-13)", () => {
  it("hoje: 'Hoje às HH:mm'", () => {
    expect(formatarDataHoraRegistro("2026-09-18T21:30:00-03:00", "2026-09-18")).toBe("Hoje às 21:30");
  });

  it("ontem: 'Ontem às HH:mm'", () => {
    expect(formatarDataHoraRegistro("2026-09-17T09:05:00-03:00", "2026-09-18")).toBe("Ontem às 09:05");
  });

  it("mais antigo: 'DD Mmm, AAAA' — lado oposto de hoje/ontem", () => {
    expect(formatarDataHoraRegistro("2026-08-01T09:05:00-03:00", "2026-09-18")).toBe("01 Ago, 2026");
  });
});
